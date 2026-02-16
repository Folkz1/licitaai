import { query, queryOne } from "@/lib/db";
import { getEffectiveTenantId } from "@/lib/tenant";
import { generateApiKey, hashApiKey } from "@/lib/api-key";
import { NextRequest, NextResponse } from "next/server";

// List API keys for current tenant
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [keys, credits, usageToday] = await Promise.all([
    query(
      `SELECT id, name, key_prefix, permissions, rate_limit_per_minute, rate_limit_per_day,
              is_active, last_used_at, expires_at, created_at
       FROM api_keys
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    ),
    queryOne<{
      balance: string;
      total_purchased: string;
      total_consumed: string;
      free_credits_granted: string;
    }>(
      "SELECT balance, total_purchased, total_consumed, free_credits_granted FROM api_credits WHERE tenant_id = $1",
      [tenantId]
    ),
    queryOne<{ calls: string; credits_spent: string }>(
      `SELECT COUNT(*) as calls, COALESCE(SUM(credits_consumed), 0) as credits_spent
       FROM api_usage WHERE tenant_id = $1 AND created_at > CURRENT_DATE`,
      [tenantId]
    ),
  ]);

  return NextResponse.json({
    keys,
    credits: {
      balance: parseFloat(credits?.balance || "0"),
      total_purchased: parseFloat(credits?.total_purchased || "0"),
      total_consumed: parseFloat(credits?.total_consumed || "0"),
      free_granted: parseFloat(credits?.free_credits_granted || "0"),
      effective_balance:
        parseFloat(credits?.balance || "0") +
        parseFloat(credits?.free_credits_granted || "0") -
        parseFloat(credits?.total_consumed || "0"),
    },
    usage_today: {
      calls: parseInt(usageToday?.calls || "0"),
      credits_spent: parseFloat(usageToday?.credits_spent || "0"),
    },
  });
}

// Create new API key
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, permissions, expires_in_days } = body;

  if (!name || typeof name !== "string" || name.length < 2) {
    return NextResponse.json({ error: "Name is required (min 2 chars)" }, { status: 400 });
  }

  // Check max keys (limit 10 per tenant)
  const existingCount = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM api_keys WHERE tenant_id = $1",
    [tenantId]
  );
  if (parseInt(existingCount?.count || "0") >= 10) {
    return NextResponse.json({ error: "Maximum 10 API keys per tenant" }, { status: 400 });
  }

  // Generate key
  const { key, hash, prefix } = generateApiKey();

  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const validPermissions = (permissions || ["read"]).filter((p: string) =>
    ["read", "write", "trigger"].includes(p)
  );

  await query(
    `INSERT INTO api_keys (tenant_id, name, key_hash, key_prefix, permissions, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, name.trim(), hash, prefix, JSON.stringify(validPermissions), expiresAt]
  );

  // Ensure credits row exists
  await query(
    `INSERT INTO api_credits (tenant_id, balance, free_credits_granted)
     VALUES ($1, 100, 100)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId]
  );

  return NextResponse.json({
    key, // ONLY returned once, on creation!
    prefix,
    name: name.trim(),
    permissions: validPermissions,
    expires_at: expiresAt,
    message: "Guarde esta chave com seguranca. Ela nao sera exibida novamente!",
  });
}

// Delete / deactivate API key
export async function DELETE(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { key_id, action } = body;

  if (!key_id) {
    return NextResponse.json({ error: "key_id is required" }, { status: 400 });
  }

  if (action === "deactivate") {
    await query(
      "UPDATE api_keys SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [key_id, tenantId]
    );
  } else {
    await query(
      "DELETE FROM api_keys WHERE id = $1 AND tenant_id = $2",
      [key_id, tenantId]
    );
  }

  return NextResponse.json({ success: true });
}

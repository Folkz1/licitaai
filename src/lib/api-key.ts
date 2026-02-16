import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

// ─── Types ───
export interface ApiKeyContext {
  keyId: string;
  tenantId: string;
  permissions: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}

// ─── Key Generation ───
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `sk-licitaia-${raw}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 16) + "...";
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ─── Middleware: Validate API Key ───
export async function withApiKey(
  req: NextRequest,
  options: { requiredPermission?: string } = {}
): Promise<{ context: ApiKeyContext } | { error: NextResponse }> {
  // Extract API key from header
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");

  let rawKey: string | null = null;

  if (authHeader?.startsWith("Bearer sk-")) {
    rawKey = authHeader.slice(7);
  } else if (xApiKey?.startsWith("sk-")) {
    rawKey = xApiKey;
  }

  if (!rawKey) {
    return {
      error: NextResponse.json(
        {
          error: "API key required",
          message: "Include your API key in the Authorization header (Bearer sk-xxx) or X-API-Key header",
          docs: "/api/v1/docs",
        },
        { status: 401 }
      ),
    };
  }

  // Hash and lookup
  const keyHash = hashApiKey(rawKey);

  const apiKey = await queryOne<{
    id: string;
    tenant_id: string;
    permissions: string[];
    rate_limit_per_minute: number;
    rate_limit_per_day: number;
    is_active: boolean;
    expires_at: string | null;
  }>(
    `SELECT id, tenant_id, permissions, rate_limit_per_minute, rate_limit_per_day, is_active, expires_at
     FROM api_keys
     WHERE key_hash = $1`,
    [keyHash]
  );

  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: "Invalid API key", message: "The API key provided is not valid" },
        { status: 401 }
      ),
    };
  }

  if (!apiKey.is_active) {
    return {
      error: NextResponse.json(
        { error: "API key disabled", message: "This API key has been deactivated" },
        { status: 403 }
      ),
    };
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return {
      error: NextResponse.json(
        { error: "API key expired", message: "This API key has expired. Generate a new one." },
        { status: 403 }
      ),
    };
  }

  // Check permission
  const permissions = Array.isArray(apiKey.permissions) ? apiKey.permissions : ["read"];
  if (options.requiredPermission && !permissions.includes(options.requiredPermission)) {
    return {
      error: NextResponse.json(
        { error: "Insufficient permissions", message: `This key lacks '${options.requiredPermission}' permission` },
        { status: 403 }
      ),
    };
  }

  // Rate limiting: per minute
  const minuteCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM api_usage
     WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
    [apiKey.id]
  );

  if (parseInt(minuteCount?.count || "0") >= apiKey.rate_limit_per_minute) {
    return {
      error: NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Max ${apiKey.rate_limit_per_minute} requests per minute`,
          retry_after_seconds: 60,
        },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        }
      ),
    };
  }

  // Rate limiting: per day
  const dayCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM api_usage
     WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [apiKey.id]
  );

  if (parseInt(dayCount?.count || "0") >= apiKey.rate_limit_per_day) {
    return {
      error: NextResponse.json(
        {
          error: "Daily limit exceeded",
          message: `Max ${apiKey.rate_limit_per_day} requests per day`,
          retry_after_seconds: 3600,
        },
        {
          status: 429,
          headers: { "Retry-After": "3600" },
        }
      ),
    };
  }

  // Update last used
  query(
    "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
    [apiKey.id]
  ).catch(() => {});

  return {
    context: {
      keyId: apiKey.id,
      tenantId: apiKey.tenant_id,
      permissions,
      rateLimitPerMinute: apiKey.rate_limit_per_minute,
      rateLimitPerDay: apiKey.rate_limit_per_day,
    },
  };
}

// ─── Usage Tracking + Credit Deduction ───
export async function trackApiUsage(
  ctx: ApiKeyContext,
  req: NextRequest,
  endpoint: string,
  statusCode: number,
  startTime: number
): Promise<{ creditsConsumed: number; balanceRemaining: number | null }> {
  const responseTimeMs = Date.now() - startTime;

  // Get pricing
  const pricing = await queryOne<{ credits_per_call: string }>(
    `SELECT credits_per_call FROM api_pricing
     WHERE endpoint_pattern = $1 AND is_active = TRUE
     LIMIT 1`,
    [endpoint]
  );

  const creditsConsumed = parseFloat(pricing?.credits_per_call || "1");

  // Consume credits
  const consumed = await queryOne<{ result: boolean }>(
    "SELECT consume_api_credits($1, $2) as result",
    [ctx.tenantId, creditsConsumed]
  );

  // Log usage
  await query(
    `INSERT INTO api_usage (api_key_id, tenant_id, endpoint, method, status_code, response_time_ms, credits_consumed, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      ctx.keyId,
      ctx.tenantId,
      endpoint,
      req.method,
      statusCode,
      responseTimeMs,
      creditsConsumed,
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
      req.headers.get("user-agent") || "unknown",
    ]
  );

  // Get remaining balance
  const balance = await queryOne<{ balance: string }>(
    "SELECT balance FROM api_credits WHERE tenant_id = $1",
    [ctx.tenantId]
  );

  return {
    creditsConsumed,
    balanceRemaining: balance ? parseFloat(balance.balance) : null,
  };
}

// ─── Check Credits Before Request ───
export async function checkCredits(
  tenantId: string,
  endpoint: string
): Promise<{ hasCredits: boolean; required: number; balance: number }> {
  const pricing = await queryOne<{ credits_per_call: string }>(
    `SELECT credits_per_call FROM api_pricing WHERE endpoint_pattern = $1 AND is_active = TRUE LIMIT 1`,
    [endpoint]
  );
  const required = parseFloat(pricing?.credits_per_call || "1");

  const credits = await queryOne<{ balance: string; free_credits_granted: string; total_consumed: string }>(
    "SELECT balance, free_credits_granted, total_consumed FROM api_credits WHERE tenant_id = $1",
    [tenantId]
  );

  const balance = credits
    ? parseFloat(credits.balance) + parseFloat(credits.free_credits_granted) - parseFloat(credits.total_consumed)
    : 0;

  return { hasCredits: balance >= required, required, balance };
}

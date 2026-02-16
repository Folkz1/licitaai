import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

// GET - List all configs
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await query(
    "SELECT * FROM configuracoes_busca WHERE tenant_id = $1 ORDER BY created_at DESC",
    [tenantId]
  );

  return NextResponse.json({ config: configs });
}

// POST - Create new config
export async function POST() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // This endpoint is now handled by the specific route
  return NextResponse.json({ error: "Use /api/configuracoes/search to create" }, { status: 400 });
}

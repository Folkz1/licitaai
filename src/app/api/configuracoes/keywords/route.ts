import { getEffectiveTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { palavra, tipo } = await req.json();

  await query(
    "INSERT INTO palavras_chave (tenant_id, palavra, tipo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [tenantId, palavra.toLowerCase().trim(), tipo]
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");

  await query(
    "DELETE FROM palavras_chave WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );

  return NextResponse.json({ success: true });
}

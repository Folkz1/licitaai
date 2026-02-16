import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [licitacao, analise, itens] = await Promise.all([
    queryOne(
      `SELECT * FROM licitacoes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    ),
    queryOne(
      `SELECT * FROM analises WHERE licitacao_id = $1`,
      [id]
    ),
    query(
      `SELECT * FROM itens_licitacao WHERE licitacao_id = $1 ORDER BY numero_item`,
      [id]
    ),
  ]);

  if (!licitacao) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ licitacao, analise, itens });
}

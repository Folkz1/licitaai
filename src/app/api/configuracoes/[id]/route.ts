import { getEffectiveTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/configuracoes - Create new search config
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { nome, ufs, modalidades, dias_retroativos, valor_minimo, valor_maximo } = body;

  if (!nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO configuracoes_busca (
      tenant_id, nome, ufs, modalidades_contratacao, 
      dias_retroativos, valor_minimo, valor_maximo, 
      ativo, source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'MANUAL')
    RETURNING id`,
    [
      tenantId,
      nome,
      ufs || [],
      modalidades || [],
      dias_retroativos || 15,
      valor_minimo || 0,
      valor_maximo || null,
    ]
  );

  return NextResponse.json({ success: true, id: result[0]?.id });
}

// PUT /api/configuracoes - Update search config
export async function PUT(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, nome, ufs, modalidades, dias_retroativos, valor_minimo, valor_maximo, ativo } = body;

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  await query(
    `UPDATE configuracoes_busca SET
      nome = COALESCE($1, nome),
      ufs = COALESCE($2, ufs),
      modalidades_contratacao = COALESCE($3, modalidades_contratacao),
      dias_retroativos = COALESCE($4, dias_retroativos),
      valor_minimo = COALESCE($5, valor_minimo),
      valor_maximo = $6,
      ativo = COALESCE($7, ativo),
      updated_at = NOW()
    WHERE id = $8 AND tenant_id = $9`,
    [nome, ufs, modalidades, dias_retroativos, valor_minimo, valor_maximo, ativo, id, tenantId]
  );

  return NextResponse.json({ success: true });
}

// DELETE /api/configuracoes - Delete search config
export async function DELETE(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  await query("DELETE FROM configuracoes_busca WHERE id = $1 AND tenant_id = $2", [id, tenantId]);

  return NextResponse.json({ success: true });
}

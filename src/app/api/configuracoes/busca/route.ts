import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar todas as configurações de busca do tenant
export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await query(
    `SELECT id, nome, modalidades_contratacao, ufs, dias_retroativos,
            valor_minimo, valor_maximo, buscar_srp, buscar_me_epp, ativa, source, created_at, updated_at
     FROM configuracoes_busca
     WHERE tenant_id = $1
     ORDER BY ativa DESC, created_at ASC`,
    [tenantId]
  );

  return NextResponse.json(configs);
}

// POST - Criar nova configuração de busca
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    nome,
    ufs = [],
    modalidades_contratacao = [6, 8],
    dias_retroativos = 15,
    valor_minimo = 0,
    valor_maximo = null,
    buscar_srp = true,
    buscar_me_epp = true,
    ativa = true,
  } = body;

  if (!nome?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const result = await queryOne<{ id: number }>(
    `INSERT INTO configuracoes_busca
     (tenant_id, nome, ufs, modalidades_contratacao, dias_retroativos, valor_minimo, valor_maximo, buscar_srp, buscar_me_epp, ativa, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'MANUAL')
     RETURNING id`,
    [tenantId, nome.trim(), ufs, modalidades_contratacao, dias_retroativos, valor_minimo, valor_maximo, buscar_srp, buscar_me_epp, ativa]
  );

  return NextResponse.json({ success: true, id: result?.id });
}

// PUT - Atualizar configuração existente
export async function PUT(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, nome, ufs, modalidades_contratacao, dias_retroativos, valor_minimo, valor_maximo, buscar_srp, buscar_me_epp, ativa } = body;

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  await query(
    `UPDATE configuracoes_busca SET
       nome = COALESCE($3, nome),
       ufs = COALESCE($4, ufs),
       modalidades_contratacao = COALESCE($5, modalidades_contratacao),
       dias_retroativos = COALESCE($6, dias_retroativos),
       valor_minimo = COALESCE($7, valor_minimo),
       valor_maximo = $8,
       buscar_srp = COALESCE($9, buscar_srp),
       buscar_me_epp = COALESCE($10, buscar_me_epp),
       ativa = COALESCE($11, ativa),
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId, nome, ufs, modalidades_contratacao, dias_retroativos, valor_minimo, valor_maximo, buscar_srp, buscar_me_epp, ativa]
  );

  return NextResponse.json({ success: true });
}

// DELETE - Remover configuração
export async function DELETE(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  await query(
    "DELETE FROM configuracoes_busca WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );

  return NextResponse.json({ success: true });
}

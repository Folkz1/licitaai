import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const searchParams = req.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;
  const status = searchParams.get("status");
  const phase = searchParams.get("phase");
  const uf = searchParams.get("uf");
  const priority = searchParams.get("priority");
  const search = searchParams.get("search");
  const deadlineUntil = searchParams.get("deadline_until");

  let whereClause = "WHERE l.tenant_id = $1";
  const params: unknown[] = [tenantId];
  let paramCount = 1;

  if (status) {
    paramCount++;
    whereClause += ` AND l.status = $${paramCount}`;
    params.push(status);
  }

  if (phase) {
    paramCount++;
    whereClause += ` AND l.review_phase = $${paramCount}`;
    params.push(phase);
  }

  if (uf) {
    paramCount++;
    whereClause += ` AND l.uf = $${paramCount}`;
    params.push(uf);
  }

  if (priority) {
    paramCount++;
    whereClause += ` AND l.prioridade_auto = $${paramCount}`;
    params.push(priority);
  }

  // only_relevant=true: mostra apenas P1/P2 (e nao analisadas ainda)
  // ignora P3 e REJEITAR — decisao de pipeline da reuniao Erikson
  const onlyRelevant = searchParams.get("only_relevant");
  if (onlyRelevant === "true") {
    whereClause += ` AND (l.prioridade_auto IN ('P1', 'P2') OR l.prioridade_auto IS NULL)`;
  }

  if (search) {
    paramCount++;
    whereClause += ` AND (
      l.objeto_compra ILIKE $${paramCount}
      OR l.orgao_nome ILIKE $${paramCount}
      OR l.municipio ILIKE $${paramCount}
      OR l.uf ILIKE $${paramCount}
      OR l.numero_controle_pncp ILIKE $${paramCount}
      OR l.modalidade_contratacao ILIKE $${paramCount}
      OR l.link_sistema_origem ILIKE $${paramCount}
    )`;
    params.push(`%${search}%`);
  }

  if (deadlineUntil) {
    paramCount++;
    whereClause += ` AND l.data_encerramento_proposta <= $${paramCount}`;
    params.push(deadlineUntil);
  }

  const period = searchParams.get("period");
  const analyzed = searchParams.get("analyzed");
  if (period === "today") {
    if (analyzed === "true") {
      whereClause += ` AND a.id IS NOT NULL AND (a.updated_at AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`;
    } else {
      whereClause += ` AND (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`;
    }
  } else if (period === "week") {
    whereClause += ` AND l.created_at >= CURRENT_DATE - INTERVAL '7 days'`;
  } else if (period === "month") {
    whereClause += ` AND l.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
  }

  if (analyzed === "true" && period !== "today") {
    whereClause += ` AND a.id IS NOT NULL`;
  } else if (analyzed === "false") {
    whereClause += ` AND a.id IS NULL`;
  }

  const source = searchParams.get("source");
  if (source === "manual") {
    whereClause += ` AND l.numero_controle_pncp LIKE 'MANUAL-%'`;
  }

  const excludePhase = searchParams.get("exclude_phase");
  if (excludePhase) {
    const excluded = excludePhase.split(",").map((_, i) => `$${paramCount + 1 + i}`);
    excludePhase.split(",").forEach((p) => params.push(p));
    paramCount += excludePhase.split(",").length;
    whereClause += ` AND l.review_phase NOT IN (${excluded.join(",")})`;
  }

  // pipeline=true: exclui NOVA expiradas (nunca analisadas, sem valor de pipeline)
  // e exclui REJEITADA (buscada separadamente on-demand)
  const pipelineMode = searchParams.get("pipeline") === "true";
  if (pipelineMode) {
    whereClause += ` AND NOT (
      l.review_phase = 'NOVA'
      AND l.data_encerramento_proposta < NOW()
    )`;
    whereClause += ` AND l.review_phase != 'REJEITADA'`;
  }

  const sortBy = searchParams.get("sort_by") || "deadline";
  const orderBy = sortBy === "publicacao"
    ? "ORDER BY l.data_publicacao DESC NULLS LAST"
    : sortBy === "valor"
    ? "ORDER BY l.valor_total_estimado DESC NULLS LAST"
    : "ORDER BY expirada ASC, l.data_encerramento_proposta ASC NULLS LAST";

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT l.id, l.numero_controle_pncp, l.orgao_nome, l.objeto_compra,
              l.valor_total_estimado, l.modalidade_contratacao, l.tipo_participacao,
              l.data_publicacao, l.data_encerramento_proposta, l.uf, l.municipio,
              l.link_sistema_origem, l.status, l.review_phase, l.assigned_to,
              l.priority_override, l.created_at,
              a.prioridade, a.tipo_oportunidade, a.score_relevancia, a.justificativa, a.amostra_exigida,
              a.valor_itens_relevantes,
              CASE WHEN l.data_encerramento_proposta < NOW() THEN true ELSE false END as expirada
       FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       ${whereClause}
       ${orderBy}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total
       FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       ${whereClause}`,
      params
    ),
  ]);

  return NextResponse.json({
    data: rows,
    pagination: {
      page,
      limit,
      total: parseInt((countResult[0] as { total: string }).total),
      totalPages: Math.ceil(parseInt((countResult[0] as { total: string }).total) / limit),
    },
  });
}

// POST /api/licitacoes — criar licitação manualmente
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    orgao_nome,
    objeto_compra,
    valor_total_estimado,
    uf,
    municipio,
    modalidade_contratacao,
    tipo_participacao,
    data_encerramento_proposta,
    data_publicacao,
    link_sistema_origem,
    numero_controle_pncp, // optional — from external system
    informacao_complementar,
  } = body;

  if (!orgao_nome || !objeto_compra) {
    return NextResponse.json({ error: "orgao_nome e objeto_compra sao obrigatorios" }, { status: 400 });
  }

  // Generate fake NCP for manual entries (must be unique per tenant)
  const ncp = numero_controle_pncp || `MANUAL-${randomUUID()}`;

  // Check for duplicate NCP
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM licitacoes WHERE tenant_id = $1 AND numero_controle_pncp = $2`,
    [tenantId, ncp]
  );
  if (existing) {
    return NextResponse.json({ error: "Licitacao com esse numero ja existe", id: existing.id }, { status: 409 });
  }

  const row = await queryOne<{ id: string }>(
    `INSERT INTO licitacoes (
      tenant_id, numero_controle_pncp, orgao_nome, objeto_compra,
      valor_total_estimado, uf, municipio, modalidade_contratacao,
      tipo_participacao, data_encerramento_proposta, data_publicacao,
      link_sistema_origem, informacao_complementar,
      status, review_phase, passou_pre_triagem
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'NOVA','NOVA',true)
    RETURNING id`,
    [
      tenantId, ncp, orgao_nome, objeto_compra,
      valor_total_estimado || null, uf || null, municipio || null,
      modalidade_contratacao || null, tipo_participacao || null,
      data_encerramento_proposta || null, data_publicacao || null,
      link_sistema_origem || null, informacao_complementar || null,
    ]
  );

  return NextResponse.json({ id: row?.id }, { status: 201 });
}

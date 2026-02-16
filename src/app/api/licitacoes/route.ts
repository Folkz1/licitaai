import { getEffectiveTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

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
    whereClause += ` AND a.prioridade = $${paramCount}`;
    params.push(priority);
  }

  if (search) {
    paramCount++;
    whereClause += ` AND (l.objeto_compra ILIKE $${paramCount} OR l.orgao_nome ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT l.id, l.numero_controle_pncp, l.orgao_nome, l.objeto_compra,
              l.valor_total_estimado, l.modalidade_contratacao, l.tipo_participacao,
              l.data_publicacao, l.data_encerramento_proposta, l.uf, l.municipio,
              l.link_sistema_origem, l.status, l.review_phase, l.assigned_to,
              l.priority_override, l.created_at,
<<<<<<< HEAD
              a.prioridade, a.score_relevancia, a.justificativa, a.amostra_exigida,
              a.valor_itens_relevantes
       FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       ${whereClause}
       ORDER BY l.data_encerramento_proposta ASC NULLS LAST
=======
              a.prioridade, a.tipo_oportunidade, a.score_relevancia, a.justificativa, a.amostra_exigida,
              a.valor_itens_relevantes,
              CASE WHEN l.data_encerramento_proposta < NOW() THEN true ELSE false END as expirada
       FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       ${whereClause}
       ORDER BY expirada ASC, l.data_encerramento_proposta ASC NULLS LAST
>>>>>>> master
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

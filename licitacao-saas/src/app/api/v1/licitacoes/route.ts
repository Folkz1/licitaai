import { query } from "@/lib/db";
import { withApiKey, trackApiUsage, checkCredits } from "@/lib/api-key";
import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = "GET /api/v1/licitacoes";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Authenticate
  const auth = await withApiKey(req, { requiredPermission: "read" });
  if ("error" in auth) return auth.error;
  const { context } = auth;

  // Check credits
  const credits = await checkCredits(context.tenantId, ENDPOINT);
  if (!credits.hasCredits) {
    return NextResponse.json(
      {
        error: "Insufficient credits",
        message: `This request costs ${credits.required} credits. Your balance: ${credits.balance}`,
        balance: credits.balance,
        required: credits.required,
        top_up_url: "/configuracoes/api-keys",
      },
      { status: 402 }
    );
  }

  // Parse params
  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;
  const status = searchParams.get("status");
  const uf = searchParams.get("uf");
  const search = searchParams.get("search");
  const priority = searchParams.get("priority");
  const modalidade = searchParams.get("modalidade");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const sortBy = searchParams.get("sort_by") || "data_encerramento_proposta";
  const sortOrder = searchParams.get("sort_order") === "desc" ? "DESC" : "ASC";

  // Build query
  let whereClause = "WHERE l.tenant_id = $1";
  const params: unknown[] = [context.tenantId];
  let paramIdx = 1;

  if (status) {
    paramIdx++;
    whereClause += ` AND l.status = $${paramIdx}`;
    params.push(status);
  }
  if (uf) {
    paramIdx++;
    whereClause += ` AND l.uf = $${paramIdx}`;
    params.push(uf);
  }
  if (search) {
    paramIdx++;
    whereClause += ` AND (l.objeto_compra ILIKE $${paramIdx} OR l.orgao_nome ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
  }
  if (priority) {
    paramIdx++;
    whereClause += ` AND a.prioridade = $${paramIdx}`;
    params.push(priority);
  }
  if (modalidade) {
    paramIdx++;
    whereClause += ` AND l.modalidade_contratacao ILIKE $${paramIdx}`;
    params.push(`%${modalidade}%`);
  }
  if (dateFrom) {
    paramIdx++;
    whereClause += ` AND l.data_publicacao >= $${paramIdx}`;
    params.push(dateFrom);
  }
  if (dateTo) {
    paramIdx++;
    whereClause += ` AND l.data_publicacao <= $${paramIdx}`;
    params.push(dateTo);
  }

  // Allowed sort columns
  const allowedSorts = ["data_publicacao", "data_encerramento_proposta", "valor_total_estimado", "created_at"];
  const safeSort = allowedSorts.includes(sortBy) ? `l.${sortBy}` : "l.data_encerramento_proposta";

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT l.id, l.numero_controle_pncp, l.orgao_nome, l.objeto_compra,
              l.valor_total_estimado, l.modalidade_contratacao, l.tipo_participacao,
              l.data_publicacao, l.data_encerramento_proposta, l.uf, l.municipio,
              l.link_sistema_origem, l.status,
              a.prioridade, a.score_relevancia, a.amostra_exigida, a.valor_itens_relevantes
       FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       ${whereClause}
       ORDER BY ${safeSort} ${sortOrder} NULLS LAST
       LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) as total
       FROM licitacoes l LEFT JOIN analises a ON a.licitacao_id = l.id
       ${whereClause}`,
      params
    ),
  ]);

  const total = parseInt((countResult[0] as { total: string }).total);

  // Track usage
  const usage = await trackApiUsage(context, req, ENDPOINT, 200, startTime);

  return NextResponse.json(
    {
      data: rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      _meta: {
        credits_consumed: usage.creditsConsumed,
        credits_remaining: usage.balanceRemaining,
        response_time_ms: Date.now() - startTime,
      },
    },
    {
      headers: {
        "X-Credits-Consumed": String(usage.creditsConsumed),
        "X-Credits-Remaining": String(usage.balanceRemaining || 0),
        "X-RateLimit-Limit": String(context.rateLimitPerMinute),
      },
    }
  );
}

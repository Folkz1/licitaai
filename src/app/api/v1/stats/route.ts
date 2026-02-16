import { query } from "@/lib/db";
import { withApiKey, trackApiUsage, checkCredits } from "@/lib/api-key";
import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = "GET /api/v1/stats";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  const auth = await withApiKey(req, { requiredPermission: "read" });
  if ("error" in auth) return auth.error;
  const { context } = auth;

  const credits = await checkCredits(context.tenantId, ENDPOINT);
  if (!credits.hasCredits) {
    return NextResponse.json(
      { error: "Insufficient credits", balance: credits.balance, required: credits.required },
      { status: 402 }
    );
  }

  const [kpis, byUf, byPriority] = await Promise.all([
    query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ANALISADA') as analisadas,
        COUNT(*) FILTER (WHERE status = 'NOVA') as novas,
        COUNT(*) FILTER (WHERE review_phase IN ('DECISAO','PREPARACAO','PARTICIPANDO')) as no_pipeline,
        COUNT(*) FILTER (WHERE review_phase = 'CONCLUIDA') as concluidas,
        COALESCE(SUM(valor_total_estimado) FILTER (WHERE review_phase IN ('DECISAO','PREPARACAO','PARTICIPANDO')), 0) as valor_pipeline,
        COALESCE(SUM(valor_total_estimado), 0) as valor_total
      FROM licitacoes WHERE tenant_id = $1`,
      [context.tenantId]
    ),
    query(
      `SELECT uf, COUNT(*) as count FROM licitacoes
       WHERE tenant_id = $1 AND uf IS NOT NULL
       GROUP BY uf ORDER BY count DESC LIMIT 10`,
      [context.tenantId]
    ),
    query(
      `SELECT a.prioridade, COUNT(*) as count
       FROM analises a JOIN licitacoes l ON l.id = a.licitacao_id
       WHERE l.tenant_id = $1 AND a.prioridade IS NOT NULL
       GROUP BY a.prioridade`,
      [context.tenantId]
    ),
  ]);

  const usage = await trackApiUsage(context, req, ENDPOINT, 200, startTime);

  return NextResponse.json({
    data: { kpis: kpis[0], by_uf: byUf, by_priority: byPriority },
    _meta: {
      credits_consumed: usage.creditsConsumed,
      credits_remaining: usage.balanceRemaining,
      response_time_ms: Date.now() - startTime,
    },
  });
}

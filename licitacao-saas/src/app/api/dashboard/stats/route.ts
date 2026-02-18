import { getEffectiveTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [kpis, byUf, byPriority, byWeek, byPhase, urgent, todayActivity] = await Promise.all([
    // KPIs (join analises to count correctly - n8n may not update licitacoes.status for pre-triagem rejections)
    query(
      `SELECT
        COUNT(*) as total,
        COUNT(a.id) as analisadas,
        COUNT(*) FILTER (WHERE a.id IS NULL) as novas,
        COUNT(*) FILTER (WHERE l.review_phase IN ('DECISAO','PREPARACAO','PARTICIPANDO')) as no_pipeline,
        COUNT(*) FILTER (WHERE l.review_phase = 'CONCLUIDA') as concluidas,
        COALESCE(SUM(l.valor_total_estimado) FILTER (WHERE l.review_phase IN ('DECISAO','PREPARACAO','PARTICIPANDO')), 0) as valor_pipeline,
        COALESCE(SUM(l.valor_total_estimado), 0) as valor_total
      FROM licitacoes l
      LEFT JOIN analises a ON a.licitacao_id = l.id
      WHERE l.tenant_id = $1`,
      [tenantId]
    ),
    // By UF
    query(
      `SELECT uf, COUNT(*) as count
       FROM licitacoes WHERE tenant_id = $1 AND uf IS NOT NULL
       GROUP BY uf ORDER BY count DESC LIMIT 10`,
      [tenantId]
    ),
    // By Priority
    query(
      `SELECT a.prioridade, COUNT(*) as count
       FROM analises a
       JOIN licitacoes l ON l.id = a.licitacao_id
       WHERE l.tenant_id = $1 AND a.prioridade IS NOT NULL
       GROUP BY a.prioridade`,
      [tenantId]
    ),
    // By Week
    query(
      `SELECT DATE_TRUNC('week', data_publicacao)::date as semana, COUNT(*) as count
       FROM licitacoes WHERE tenant_id = $1 AND data_publicacao > NOW() - INTERVAL '8 weeks'
       GROUP BY semana ORDER BY semana`,
      [tenantId]
    ),
    // By Review Phase
    query(
      `SELECT COALESCE(review_phase, 'NOVA') as phase, COUNT(*) as count
       FROM licitacoes WHERE tenant_id = $1
       GROUP BY review_phase`,
      [tenantId]
    ),
    // Urgent: closing within 7 days
    query(
      `SELECT l.id, l.orgao_nome, l.objeto_compra, l.valor_total_estimado,
              l.data_encerramento_proposta, l.uf,
              COALESCE(a.prioridade, 'P3') as prioridade
       FROM licitacoes l
       LEFT JOIN analises a ON a.licitacao_id = l.id
       WHERE l.tenant_id = $1
         AND l.data_encerramento_proposta IS NOT NULL
         AND l.data_encerramento_proposta > NOW()
         AND l.data_encerramento_proposta <= NOW() + INTERVAL '7 days'
         AND l.review_phase NOT IN ('REJEITADA', 'CONCLUIDA')
       ORDER BY l.data_encerramento_proposta ASC
       LIMIT 5`,
      [tenantId]
    ),
    // Today's activity (using São Paulo timezone, analises.created_at as source of truth)
    query(
      `WITH tz AS (
        SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date as hoje
      )
      SELECT
        COUNT(*) FILTER (WHERE (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje) as novas_hoje,
        COUNT(*) FILTER (WHERE a.id IS NOT NULL AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje) as analisadas_hoje,
        COUNT(*) FILTER (WHERE a.prioridade = 'P1' AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje) as p1_hoje,
        COUNT(*) FILTER (WHERE a.prioridade = 'P2' AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje) as p2_hoje,
        COUNT(*) FILTER (WHERE a.prioridade = 'P3' AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje) as p3_hoje,
        COUNT(*) FILTER (WHERE a.tipo_oportunidade = 'PRE_TRIAGEM_REJEITAR' AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje) as rejeitadas_ia_hoje,
        COUNT(*) FILTER (WHERE (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje - 1) as novas_ontem,
        COUNT(*) FILTER (WHERE a.id IS NOT NULL AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date = tz.hoje - 1) as analisadas_ontem
       FROM licitacoes l
       CROSS JOIN tz
       LEFT JOIN analises a ON a.licitacao_id = l.id
       WHERE l.tenant_id = $1`,
      [tenantId]
    ),
  ]);

  return NextResponse.json({
    kpis: kpis[0],
    byUf,
    byPriority,
    byWeek,
    byPhase,
    urgent,
    todayActivity: todayActivity[0],
  });
}

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
    // KPIs
    query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('ANALISADA', 'SEM_EDITAL', 'ERRO_OCR') OR review_phase = 'REJEITADA') as analisadas,
        COUNT(*) FILTER (WHERE status = 'NOVA') as novas,
        COUNT(*) FILTER (WHERE review_phase IN ('DECISAO','PREPARACAO','PARTICIPANDO')) as no_pipeline,
        COUNT(*) FILTER (WHERE review_phase = 'CONCLUIDA') as concluidas,
        COALESCE(SUM(valor_total_estimado) FILTER (WHERE review_phase IN ('DECISAO','PREPARACAO','PARTICIPANDO')), 0) as valor_pipeline,
        COALESCE(SUM(valor_total_estimado), 0) as valor_total
      FROM licitacoes WHERE tenant_id = $1`,
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
    // Today's activity
    query(
      `SELECT
        COUNT(*) FILTER (WHERE l.created_at >= CURRENT_DATE) as novas_hoje,
        COUNT(*) FILTER (WHERE a.created_at >= CURRENT_DATE) as analisadas_hoje,
        COUNT(*) FILTER (WHERE a.created_at >= CURRENT_DATE AND a.prioridade = 'P1') as p1_hoje,
        COUNT(*) FILTER (WHERE a.created_at >= CURRENT_DATE AND a.prioridade = 'P2') as p2_hoje,
        COUNT(*) FILTER (WHERE a.created_at >= CURRENT_DATE AND a.prioridade = 'P3') as p3_hoje,
        COUNT(*) FILTER (WHERE a.created_at >= CURRENT_DATE AND a.tipo_oportunidade = 'PRE_TRIAGEM_REJEITAR') as rejeitadas_ia_hoje,
        COUNT(*) FILTER (WHERE l.created_at >= CURRENT_DATE - INTERVAL '1 day' AND l.created_at < CURRENT_DATE) as novas_ontem,
        COUNT(*) FILTER (WHERE a.created_at >= CURRENT_DATE - INTERVAL '1 day' AND a.created_at < CURRENT_DATE) as analisadas_ontem
       FROM licitacoes l
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

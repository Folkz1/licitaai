import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [funnel, metrics, leads, recentMessages] = await Promise.all([
    // Funnel
    query<{ status: string; total: string }>(
      `WITH leads_base AS (
        SELECT
          pl.*,
          CASE
            WHEN pl.trial_expires_at IS NOT NULL
              AND pl.trial_expires_at < NOW()
              AND COALESCE(pl.status, 'novo') IN ('trial_ativo', 'trial_expirado', 'qualificado')
              THEN 'trial_expirado'
            WHEN COALESCE(pl.status, 'novo') = 'trial_ativo'
              AND (pl.trial_expires_at IS NULL OR pl.trial_expires_at >= NOW())
              THEN 'trial_ativo'
            ELSE COALESCE(pl.status, 'novo')
          END AS lead_stage
        FROM portal_leads pl
      )
      SELECT lead_stage as status, COUNT(*)::TEXT as total
      FROM leads_base
      GROUP BY lead_stage
      ORDER BY total DESC`
    ),

    // Metrics
    queryOne<{
      leads_semana: string;
      leads_mes: string;
      convertidos: string;
      trials_ativos: string;
      trials_expirados: string;
      trials_vencendo: string;
      score_medio: string;
      msgs_enviadas: string;
    }>(
      `WITH leads_base AS (
        SELECT
          pl.*,
          CASE
            WHEN pl.trial_expires_at IS NOT NULL
              AND pl.trial_expires_at < NOW()
              AND COALESCE(pl.status, 'novo') IN ('trial_ativo', 'trial_expirado', 'qualificado')
              THEN 'trial_expirado'
            WHEN COALESCE(pl.status, 'novo') = 'trial_ativo'
              AND (pl.trial_expires_at IS NULL OR pl.trial_expires_at >= NOW())
              THEN 'trial_ativo'
            ELSE COALESCE(pl.status, 'novo')
          END AS lead_stage
        FROM portal_leads pl
      )
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::TEXT as leads_semana,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::TEXT as leads_mes,
        COUNT(*) FILTER (WHERE lead_stage = 'convertido')::TEXT as convertidos,
        COUNT(*) FILTER (WHERE lead_stage = 'trial_ativo')::TEXT as trials_ativos,
        COUNT(*) FILTER (WHERE lead_stage = 'trial_expirado')::TEXT as trials_expirados,
        COUNT(*) FILTER (
          WHERE lead_stage = 'trial_ativo'
            AND trial_expires_at IS NOT NULL
            AND trial_expires_at <= NOW() + INTERVAL '48 hours'
        )::TEXT as trials_vencendo,
        COALESCE(AVG(score), 0)::INT::TEXT as score_medio,
        (SELECT COUNT(*)::TEXT FROM lead_sequences WHERE status = 'sent')::TEXT as msgs_enviadas
      FROM leads_base`
    ),

    // Leads list
    query<{
      id: string;
      nome: string;
      empresa: string | null;
      telefone: string | null;
      interesse: string | null;
      score: number;
      status: string;
      trial_status: string | null;
      trial_expires_at: string | null;
      trial_days_left: number | null;
      tenant_id: string | null;
      qualification_channel: string | null;
      last_contacted_at: string | null;
      created_at: string;
      msgs_sent: string;
    }>(
      `WITH leads_base AS (
        SELECT
          pl.*,
          CASE
            WHEN pl.trial_expires_at IS NOT NULL
              AND pl.trial_expires_at < NOW()
              AND COALESCE(pl.status, 'novo') IN ('trial_ativo', 'trial_expirado', 'qualificado')
              THEN 'trial_expirado'
            WHEN COALESCE(pl.status, 'novo') = 'trial_ativo'
              AND (pl.trial_expires_at IS NULL OR pl.trial_expires_at >= NOW())
              THEN 'trial_ativo'
            ELSE COALESCE(pl.status, 'novo')
          END AS lead_stage
        FROM portal_leads pl
      )
      SELECT
        lb.id,
        lb.nome,
        lb.empresa,
        lb.telefone,
        lb.interesse,
        lb.score,
        lb.lead_stage as status,
        lb.trial_status,
        lb.trial_expires_at,
        CASE
          WHEN lb.trial_expires_at IS NULL THEN NULL
          ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (lb.trial_expires_at - NOW())) / 86400.0))::INT
        END as trial_days_left,
        lb.tenant_id,
        lb.qualification_channel,
        lb.last_contacted_at,
        lb.created_at,
        (
          SELECT COUNT(*)::TEXT
          FROM lead_sequences ls
          WHERE ls.lead_id = lb.id AND ls.status = 'sent'
        ) as msgs_sent
      FROM leads_base lb
      ORDER BY
        CASE lb.lead_stage
          WHEN 'trial_ativo' THEN 0
          WHEN 'qualificado' THEN 1
          WHEN 'nurturing' THEN 2
          WHEN 'novo' THEN 3
          WHEN 'trial_expirado' THEN 4
          WHEN 'convertido' THEN 5
          ELSE 6
        END,
        COALESCE(lb.trial_expires_at, lb.created_at) DESC,
        lb.created_at DESC
      LIMIT 100`
    ),

    // Recent messages
    query<{ lead_name: string; step: number; status: string; sent_at: string | null }>(
      `SELECT pl.nome as lead_name, ls.step, ls.status, ls.sent_at
       FROM lead_sequences ls
       JOIN portal_leads pl ON pl.id = ls.lead_id
       ORDER BY ls.created_at DESC
       LIMIT 20`
    ),
  ]);

  return NextResponse.json({ funnel, metrics, leads, recentMessages });
}

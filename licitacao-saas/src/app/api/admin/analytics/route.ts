import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { PORTAL_PUBLIC_TENANT_ID, UF_NAMES } from "@/lib/portal";
import { NextResponse } from "next/server";

interface DailyMetricRow {
  day: string;
  visitantes?: string;
  pageviews?: string;
  leads?: string;
  buscas?: string;
  licitacoes?: string;
}

function buildLast30DaysMap() {
  const entries = new Map<
    string,
    { day: string; visitantes: number; pageviews: number; leads: number; buscas: number; licitacoes: number }
  >();

  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);

    const key = day.toISOString().slice(0, 10);
    entries.set(key, {
      day: key,
      visitantes: 0,
      pageviews: 0,
      leads: 0,
      buscas: 0,
      licitacoes: 0,
    });
  }

  return entries;
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) {
    return 0;
  }

  return Number(value) || 0;
}

export async function GET() {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      visitorSummaryRows,
      leadSummaryRows,
      searchSummaryRows,
      activeUsersRows,
      subscriptionSummaryRows,
      conversionRows,
      visitsByDayRows,
      leadsByDayRows,
      searchesByDayRows,
      licitacoesByDayRows,
      topPagesRows,
      topSearchTermsRows,
      leadsBySourceRows,
      usersByPlanRows,
      latestLeadsRows,
      latestSignupsRows,
      powerUsersRows,
      statesRows,
    ] = await Promise.all([
      query<{
        visitors_today: string;
        visitors_yesterday: string;
        visitors_last_7_days: string;
        visitors_last_30_days: string;
      }>(
        `SELECT
          (COUNT(DISTINCT session_id) FILTER (WHERE created_at >= CURRENT_DATE))::TEXT AS visitors_today,
          (COUNT(DISTINCT session_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE))::TEXT AS visitors_yesterday,
          (COUNT(DISTINCT session_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'))::TEXT AS visitors_last_7_days,
          (COUNT(DISTINCT session_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'))::TEXT AS visitors_last_30_days
         FROM page_views`
      ),
      query<{
        leads_today: string;
        leads_last_7_days: string;
        leads_last_30_days: string;
      }>(
        `SELECT
          (COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE))::TEXT AS leads_today,
          (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'))::TEXT AS leads_last_7_days,
          (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'))::TEXT AS leads_last_30_days
         FROM portal_leads`
      ),
      query<{
        searches_today: string;
        searches_last_7_days: string;
      }>(
        `SELECT
          (COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE))::TEXT AS searches_today,
          (COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'))::TEXT AS searches_last_7_days
         FROM portal_searches`
      ),
      query<{ active_users_last_7_days: string }>(
        `SELECT COUNT(*)::TEXT AS active_users_last_7_days
         FROM users
         WHERE ativo = TRUE
           AND ultimo_login >= NOW() - INTERVAL '7 days'`
      ),
      query<{
        active_subscribers: string;
        trial_subscribers: string;
        expired_subscribers: string;
      }>(
        `SELECT
          (COUNT(*) FILTER (WHERE status = 'ACTIVE'))::TEXT AS active_subscribers,
          (COUNT(*) FILTER (WHERE status = 'TRIAL'))::TEXT AS trial_subscribers,
          (COUNT(*) FILTER (
            WHERE status IN ('CANCELLED', 'PAST_DUE', 'SUSPENDED')
               OR (expires_at IS NOT NULL AND expires_at < NOW() AND status <> 'ACTIVE')
          ))::TEXT AS expired_subscribers
         FROM subscriptions`
      ),
      query<{
        total_leads: string;
        total_signups: string;
        total_assinantes: string;
      }>(
        `SELECT
          (SELECT COUNT(*)::TEXT FROM portal_leads) AS total_leads,
          (SELECT COUNT(*)::TEXT FROM users WHERE role <> 'SUPER_ADMIN') AS total_signups,
          (SELECT COUNT(DISTINCT tenant_id)::TEXT FROM subscriptions WHERE status = 'ACTIVE') AS total_assinantes`
      ),
      query<DailyMetricRow>(
        `SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
          COUNT(DISTINCT session_id)::TEXT AS visitantes,
          COUNT(*)::TEXT AS pageviews
         FROM page_views
         WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at)`
      ),
      query<DailyMetricRow>(
        `SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::TEXT AS leads
         FROM portal_leads
         WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at)`
      ),
      query<DailyMetricRow>(
        `SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::TEXT AS buscas
         FROM portal_searches
         WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at)`
      ),
      query<DailyMetricRow>(
        `SELECT
          TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::TEXT AS licitacoes
         FROM licitacoes
         WHERE tenant_id = $1
           AND created_at >= CURRENT_DATE - INTERVAL '29 days'
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at)`,
        [PORTAL_PUBLIC_TENANT_ID]
      ),
      query<{ path: string; views: string }>(
        `SELECT path, COUNT(*)::TEXT AS views
         FROM page_views
         WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY path
         ORDER BY views DESC
         LIMIT 10`
      ),
      query<{ query: string; count: string }>(
        `SELECT query, COUNT(*)::TEXT AS count
         FROM portal_searches
         WHERE created_at >= NOW() - INTERVAL '7 days'
           AND COALESCE(TRIM(query), '') <> ''
         GROUP BY query
         ORDER BY count DESC
         LIMIT 10`
      ),
      query<{ source: string; leads: string }>(
        `SELECT
          COALESCE(NULLIF(utm_source, ''), 'Direto') AS source,
          COUNT(*)::TEXT AS leads
         FROM portal_leads
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY COALESCE(NULLIF(utm_source, ''), 'Direto')
         ORDER BY leads DESC`
      ),
      query<{ display_name: string | null; users: string }>(
        `SELECT
          COALESCE(p.display_name, 'Sem plano') AS display_name,
          COUNT(DISTINCT u.id)::TEXT AS users
         FROM users u
         JOIN tenants t ON u.tenant_id = t.id
         LEFT JOIN subscriptions s ON s.tenant_id = t.id
         LEFT JOIN plans p ON s.plan_id = p.id
         WHERE u.role <> 'SUPER_ADMIN'
         GROUP BY COALESCE(p.display_name, 'Sem plano')
         ORDER BY users DESC`
      ),
      query<{
        nome: string;
        email: string;
        empresa: string | null;
        interesse: string | null;
        source: string | null;
        created_at: string;
      }>(
        `SELECT
          nome,
          email,
          empresa,
          interesse,
          COALESCE(NULLIF(utm_source, ''), 'Direto') AS source,
          created_at::TEXT AS created_at
         FROM portal_leads
         ORDER BY created_at DESC
         LIMIT 20`
      ),
      query<{
        nome: string;
        email: string;
        tenant: string;
        plano: string | null;
        created_at: string;
      }>(
        `SELECT
          u.nome,
          u.email,
          t.nome AS tenant,
          COALESCE(p.display_name, 'Sem plano') AS plano,
          u.created_at::TEXT AS created_at
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         LEFT JOIN subscriptions s ON s.tenant_id = t.id
         LEFT JOIN plans p ON p.id = s.plan_id
         WHERE u.role <> 'SUPER_ADMIN'
         ORDER BY u.created_at DESC
         LIMIT 20`
      ),
      query<{
        nome: string;
        email: string;
        tenant: string;
        logins: string;
        buscas: string;
        analises: string;
      }>(
        `SELECT
          u.nome,
          u.email,
          t.nome AS tenant,
          COALESCE(u.login_count, 0)::TEXT AS logins,
          (COUNT(*) FILTER (WHERE w.workflow_type ILIKE '%busca%'))::TEXT AS buscas,
          (COUNT(*) FILTER (WHERE w.workflow_type ILIKE '%analise%'))::TEXT AS analises
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         LEFT JOIN workflow_executions w
           ON w.triggered_by = u.id
          AND w.created_at >= NOW() - INTERVAL '30 days'
         WHERE u.role <> 'SUPER_ADMIN'
         GROUP BY u.id, t.nome
         ORDER BY
           (COALESCE(u.login_count, 0)
            + COUNT(*) FILTER (WHERE w.workflow_type ILIKE '%busca%')
            + COUNT(*) FILTER (WHERE w.workflow_type ILIKE '%analise%')) DESC,
           u.ultimo_login DESC NULLS LAST
         LIMIT 20`
      ),
      query<{ uf: string; searches: string }>(
        `SELECT
          COALESCE(NULLIF(UPPER(filters_json->>'uf'), ''), 'BR') AS uf,
          COUNT(*)::TEXT AS searches
         FROM portal_searches
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY COALESCE(NULLIF(UPPER(filters_json->>'uf'), ''), 'BR')
         ORDER BY searches DESC
         LIMIT 10`
      ),
    ]);

    const visitorSummary = visitorSummaryRows[0];
    const leadSummary = leadSummaryRows[0];
    const searchSummary = searchSummaryRows[0];
    const activeUsers = activeUsersRows[0];
    const subscriptionSummary = subscriptionSummaryRows[0];
    const conversion = conversionRows[0];

    const dailyMap = buildLast30DaysMap();

    for (const row of visitsByDayRows) {
      const current = dailyMap.get(row.day);
      if (current) {
        current.visitantes = toNumber(row.visitantes);
        current.pageviews = toNumber(row.pageviews);
      }
    }

    for (const row of leadsByDayRows) {
      const current = dailyMap.get(row.day);
      if (current) {
        current.leads = toNumber(row.leads);
      }
    }

    for (const row of searchesByDayRows) {
      const current = dailyMap.get(row.day);
      if (current) {
        current.buscas = toNumber(row.buscas);
      }
    }

    for (const row of licitacoesByDayRows) {
      const current = dailyMap.get(row.day);
      if (current) {
        current.licitacoes = toNumber(row.licitacoes);
      }
    }

    const totalLeads = toNumber(conversion?.total_leads);
    const totalSignups = toNumber(conversion?.total_signups);
    const totalAssinantes = toNumber(conversion?.total_assinantes);

    const response = {
      generatedAt: new Date().toISOString(),
      kpis: {
        visitors: {
          today: toNumber(visitorSummary?.visitors_today),
          yesterday: toNumber(visitorSummary?.visitors_yesterday),
          last7Days: toNumber(visitorSummary?.visitors_last_7_days),
          last30Days: toNumber(visitorSummary?.visitors_last_30_days),
        },
        leads: {
          today: toNumber(leadSummary?.leads_today),
          last7Days: toNumber(leadSummary?.leads_last_7_days),
          last30Days: toNumber(leadSummary?.leads_last_30_days),
        },
        publicSearches: {
          today: toNumber(searchSummary?.searches_today),
          last7Days: toNumber(searchSummary?.searches_last_7_days),
        },
        activeUsers: {
          last7Days: toNumber(activeUsers?.active_users_last_7_days),
        },
        subscriptions: {
          active: toNumber(subscriptionSummary?.active_subscribers),
          trial: toNumber(subscriptionSummary?.trial_subscribers),
          expired: toNumber(subscriptionSummary?.expired_subscribers),
        },
        conversion: {
          totalLeads,
          totalSignups,
          totalSubscribers: totalAssinantes,
          leadToSignupRate:
            totalLeads > 0 ? Number(((totalSignups / totalLeads) * 100).toFixed(1)) : 0,
          signupToSubscriberRate:
            totalSignups > 0
              ? Number(((totalAssinantes / totalSignups) * 100).toFixed(1))
              : 0,
          leadToSubscriberRate:
            totalLeads > 0
              ? Number(((totalAssinantes / totalLeads) * 100).toFixed(1))
              : 0,
        },
      },
      charts: {
        daily: Array.from(dailyMap.values()),
        topPages: topPagesRows.map((row) => ({
          path: row.path,
          views: toNumber(row.views),
        })),
        topSearchTerms: topSearchTermsRows.map((row) => ({
          query: row.query,
          count: toNumber(row.count),
        })),
        leadsBySource: leadsBySourceRows.map((row) => ({
          source: row.source,
          leads: toNumber(row.leads),
        })),
        usersByPlan: usersByPlanRows.map((row) => ({
          plan: row.display_name || "Sem plano",
          users: toNumber(row.users),
        })),
      },
      tables: {
        latestLeads: latestLeadsRows,
        latestSignups: latestSignupsRows,
        powerUsers: powerUsersRows.map((row) => ({
          ...row,
          logins: toNumber(row.logins),
          buscas: toNumber(row.buscas),
          analises: toNumber(row.analises),
        })),
        mostSearchedStates: statesRows.map((row) => ({
          uf: row.uf,
          nome: row.uf in UF_NAMES ? UF_NAMES[row.uf as keyof typeof UF_NAMES] : "Brasil",
          searches: toNumber(row.searches),
        })),
      },
    };

    console.log("[ADMIN-ANALYTICS] Analytics carregado com sucesso.");

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar analytics.";

    console.log(`[ADMIN-ANALYTICS] Falha ao carregar analytics: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

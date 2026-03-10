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
      "SELECT COALESCE(status, 'novo') as status, COUNT(*)::TEXT as total FROM portal_leads GROUP BY status ORDER BY total DESC"
    ),

    // Metrics
    queryOne<{
      leads_semana: string;
      leads_mes: string;
      convertidos: string;
      score_medio: string;
      msgs_enviadas: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE pl.created_at >= NOW() - INTERVAL '7 days')::TEXT as leads_semana,
        COUNT(*) FILTER (WHERE pl.created_at >= NOW() - INTERVAL '30 days')::TEXT as leads_mes,
        COUNT(*) FILTER (WHERE pl.status = 'convertido')::TEXT as convertidos,
        COALESCE(AVG(pl.score), 0)::INT::TEXT as score_medio,
        (SELECT COUNT(*)::TEXT FROM lead_sequences WHERE status = 'sent')::TEXT as msgs_enviadas
      FROM portal_leads pl`
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
      last_contacted_at: string | null;
      created_at: string;
      msgs_sent: string;
    }>(
      `SELECT pl.id, pl.nome, pl.empresa, pl.telefone, pl.interesse, pl.score,
        COALESCE(pl.status, 'novo') as status, pl.last_contacted_at, pl.created_at,
        (SELECT COUNT(*)::TEXT FROM lead_sequences ls WHERE ls.lead_id = pl.id AND ls.status = 'sent') as msgs_sent
      FROM portal_leads pl
      ORDER BY pl.created_at DESC
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

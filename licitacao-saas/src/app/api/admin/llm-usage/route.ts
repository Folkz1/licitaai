import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const tenantFilter = req.nextUrl.searchParams.get("tenant_id");
  const targetTenantId = isSuperAdmin && tenantFilter ? tenantFilter : session.user.tenantId;

  try {
    // Check if llm_usage table exists
    const tableCheck = await query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'llm_usage') as exists`
    );
    const tableExists = (tableCheck[0] as { exists: boolean }).exists;

    if (!tableExists) {
      return NextResponse.json({
        daily: [],
        byWorkflow: [],
        byTenant: [],
        currentMonth: { tokens: "0", cost: "0", calls: "0" },
        warning: "Tabela llm_usage nao existe. Execute a migration 003_llm_usage_tracking.sql",
      });
    }

    const [daily, byWorkflow, byTenant, currentMonthTotal] = await Promise.all([
      query(
        `SELECT DATE(created_at) as day, COUNT(*) as call_count,
                SUM(total_tokens) as total_tokens, SUM(cost_usd) as total_cost_usd
         FROM llm_usage
         WHERE tenant_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY day`,
        [targetTenantId]
      ),
      query(
        `SELECT workflow, model, COUNT(*) as calls, SUM(total_tokens) as tokens, SUM(cost_usd) as cost
         FROM llm_usage
         WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
         GROUP BY workflow, model ORDER BY cost DESC`,
        [targetTenantId]
      ),
      isSuperAdmin
        ? query(
            `SELECT t.id, t.nome,
                    COUNT(u.*) as total_calls,
                    COALESCE(SUM(u.total_tokens), 0) as total_tokens,
                    COALESCE(SUM(u.cost_usd), 0) as total_cost,
                    p.display_name as plan_name,
                    p.max_tokens_per_month
             FROM tenants t
             LEFT JOIN llm_usage u ON u.tenant_id = t.id AND u.created_at >= DATE_TRUNC('month', CURRENT_DATE)
             LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
             LEFT JOIN plans p ON p.id = s.plan_id
             GROUP BY t.id, t.nome, p.display_name, p.max_tokens_per_month
             ORDER BY total_cost DESC`
          ).catch(() => [])
        : Promise.resolve([]),
      query(
        `SELECT COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(cost_usd), 0) as cost, COUNT(*) as calls
         FROM llm_usage WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [targetTenantId]
      ),
    ]);

    return NextResponse.json({ daily, byWorkflow, byTenant, currentMonth: currentMonthTotal[0] });
  } catch (error) {
    console.error("LLM usage query error:", error);
    return NextResponse.json({
      daily: [],
      byWorkflow: [],
      byTenant: [],
      currentMonth: { tokens: "0", cost: "0", calls: "0" },
      error: "Erro ao buscar dados. Verifique se a migration 003 foi executada.",
    });
  }
}

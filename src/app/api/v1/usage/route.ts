import { query, queryOne } from "@/lib/db";
import { withApiKey } from "@/lib/api-key";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await withApiKey(req, { requiredPermission: "read" });
  if ("error" in auth) return auth.error;
  const { context } = auth;

  const [credits, usageToday, usageMonth, recentCalls] = await Promise.all([
    // Credit balance
    queryOne<{
      balance: string;
      total_purchased: string;
      total_consumed: string;
      free_credits_granted: string;
      alert_threshold: string;
    }>(
      "SELECT balance, total_purchased, total_consumed, free_credits_granted, alert_threshold FROM api_credits WHERE tenant_id = $1",
      [context.tenantId]
    ),
    // Usage today
    queryOne<{ calls: string; credits_spent: string }>(
      `SELECT COUNT(*) as calls, COALESCE(SUM(credits_consumed), 0) as credits_spent
       FROM api_usage WHERE tenant_id = $1 AND created_at > CURRENT_DATE`,
      [context.tenantId]
    ),
    // Usage this month
    queryOne<{ calls: string; credits_spent: string }>(
      `SELECT COUNT(*) as calls, COALESCE(SUM(credits_consumed), 0) as credits_spent
       FROM api_usage WHERE tenant_id = $1 AND created_at > DATE_TRUNC('month', CURRENT_DATE)`,
      [context.tenantId]
    ),
    // Recent calls (last 10)
    query(
      `SELECT endpoint, method, status_code, response_time_ms, credits_consumed, created_at
       FROM api_usage WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [context.tenantId]
    ),
  ]);

  return NextResponse.json({
    credits: {
      balance: parseFloat(credits?.balance || "0"),
      total_purchased: parseFloat(credits?.total_purchased || "0"),
      total_consumed: parseFloat(credits?.total_consumed || "0"),
      free_granted: parseFloat(credits?.free_credits_granted || "0"),
      effective_balance:
        parseFloat(credits?.balance || "0") +
        parseFloat(credits?.free_credits_granted || "0") -
        parseFloat(credits?.total_consumed || "0"),
    },
    usage_today: {
      calls: parseInt(usageToday?.calls || "0"),
      credits_spent: parseFloat(usageToday?.credits_spent || "0"),
    },
    usage_month: {
      calls: parseInt(usageMonth?.calls || "0"),
      credits_spent: parseFloat(usageMonth?.credits_spent || "0"),
    },
    recent_calls: recentCalls,
    rate_limits: {
      per_minute: context.rateLimitPerMinute,
      per_day: context.rateLimitPerDay,
    },
  });
}

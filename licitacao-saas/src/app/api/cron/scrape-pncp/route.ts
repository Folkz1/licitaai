import { scrapeRecentPncp } from "@/lib/pncp-scraper";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 900;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.N8N_WEBHOOK_SECRET;
  const authHeader = req.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await scrapeRecentPncp({
      workflowType: "scrape-pncp-cron",
    });

    return NextResponse.json({
      success: true,
      executionId: stats.executionId || null,
      stats,
      scheduledFor: "05:00",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao executar o cron PNCP.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

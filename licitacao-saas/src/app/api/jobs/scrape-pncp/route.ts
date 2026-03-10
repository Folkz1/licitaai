import { auth } from "@/lib/auth";
import { scrapeAllStates } from "@/lib/pncp-scraper";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 900;

function isAuthorizedWithSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.N8N_WEBHOOK_SECRET;
  const authHeader = req.headers.get("authorization");

  return Boolean(secret) && authHeader === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const hasSessionAccess = Boolean(
    session?.user && ["SUPER_ADMIN", "ADMIN"].includes(session.user.role)
  );

  if (!hasSessionAccess && !isAuthorizedWithSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      dataInicial?: string;
      dataFinal?: string;
      uf?: string;
      ufs?: string[];
    };

    const stats = await scrapeAllStates({
      dataInicial: body.dataInicial,
      dataFinal: body.dataFinal,
      uf: body.uf,
      ufs: body.ufs,
      triggeredBy: session?.user.id || null,
      workflowType: "scrape-pncp-manual",
    });

    return NextResponse.json({
      success: true,
      executionId: stats.executionId || null,
      stats,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao executar o scraper PNCP.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

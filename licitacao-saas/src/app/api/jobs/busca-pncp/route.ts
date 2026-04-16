import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { executarBusca } from "@/lib/pncp/search";
import { executarAnalise, type AnaliseResult } from "@/lib/pncp/analyze";
import { assertTenantOperationalAccess } from "@/lib/trial";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min for Vercel

// Unified: Busca PNCP → Análise IA (sequential, one execution)
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = session.user.tenantId;
    await assertTenantOperationalAccess(tenantId, "search");

    // Check if there's already a running workflow
    const running = await queryOne(
      `SELECT id FROM workflow_executions
       WHERE tenant_id = $1 AND status IN ('PENDING', 'RUNNING')`,
      [tenantId]
    );
    if (running) {
      return NextResponse.json({ error: "Ja existe um processo em andamento" }, { status: 409 });
    }

    // Create unified execution record
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
       VALUES ($1, 'busca+analise', 'RUNNING', $2, 'Etapa 1: Busca PNCP...', $3)
       RETURNING id`,
      [tenantId, session.user.id, JSON.stringify([{ time: new Date().toISOString(), message: "Busca+Analise disparada pelo dashboard", level: "info" }])]
    );
    const execId = execution?.id;

    // Step 1: BUSCA
    const buscaResult = await executarBusca(tenantId, execId, async (msg) => {
      await query(`UPDATE workflow_executions SET current_step = $2 WHERE id = $1`, [execId, msg.slice(0, 500)]);
    });

    // Step 2: ANALISE — só roda se a busca teve sucesso e inseriu algo
    let analiseResult: AnaliseResult | { success: false; stats: null; error: string | undefined } = { success: true, stats: null as never, error: undefined };
    if (!buscaResult.success) {
      // Busca falhou (API instável, 0 aprovadas) — não há o que analisar
      // workflow_executions já foi marcado ERROR/WARNING pela busca
      analiseResult = { success: false, stats: null, error: buscaResult.error };
    } else {
      await query(`UPDATE workflow_executions SET current_step = $2 WHERE id = $1`, [execId, "Etapa 2: Analise IA..."]);
      analiseResult = await executarAnalise(tenantId, execId, async (msg) => {
        await query(`UPDATE workflow_executions SET current_step = $2 WHERE id = $1`, [execId, msg.slice(0, 500)]);
      }, 15);
    }

    const success = buscaResult.success && analiseResult.success;
    const error = buscaResult.error || analiseResult.error;
    const status = !success && error?.includes("expirou")
      ? 403
      : !success && error?.includes("trial")
        ? 429
        : 200;

    return NextResponse.json(
      {
        success,
        execution_id: execId,
        busca: buscaResult.stats,
        analise: analiseResult.stats,
        error,
      },
      { status }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode || 500)
      : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

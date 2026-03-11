import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { executarAnalise } from "@/lib/pncp/analyze";
import { assertTenantOperationalAccess } from "@/lib/trial";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min for Vercel

// Standalone analysis endpoint (for re-analyzing pending licitacoes without new search)
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = session.user.tenantId;
    await assertTenantOperationalAccess(tenantId, "analysis");

    const running = await queryOne(
      `SELECT id FROM workflow_executions
       WHERE tenant_id = $1 AND status IN ('PENDING', 'RUNNING')`,
      [tenantId]
    );
    if (running) {
      return NextResponse.json({ error: "Ja existe um processo em andamento" }, { status: 409 });
    }

    const execution = await queryOne<{ id: string }>(
      `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
       VALUES ($1, 'analise', 'RUNNING', $2, 'Iniciando analise com IA...', $3)
       RETURNING id`,
      [tenantId, session.user.id, JSON.stringify([{ time: new Date().toISOString(), message: "Analise disparada pelo dashboard", level: "info" }])]
    );

    const result = await executarAnalise(tenantId, execution?.id, async (msg) => {
      await query(`UPDATE workflow_executions SET current_step = $2 WHERE id = $1`, [execution?.id, msg]);
    }, 15);

    const status = !result.success && result.error?.includes("expirou")
      ? 403
      : !result.success && result.error?.includes("trial")
        ? 429
        : 200;

    return NextResponse.json(
      { success: result.success, execution_id: execution?.id, stats: result.stats, error: result.error },
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

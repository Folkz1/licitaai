import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { executarAnalise } from "@/lib/pncp/analyze";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min for Vercel

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = session.user.tenantId;

    // Check if there's already a running analysis
    const running = await queryOne(
      `SELECT id FROM workflow_executions
       WHERE tenant_id = $1 AND workflow_type = 'analise' AND status IN ('PENDING', 'RUNNING')`,
      [tenantId]
    );
    if (running) {
      return NextResponse.json({ error: "Ja existe uma analise em andamento" }, { status: 409 });
    }

    // Create execution record
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
       VALUES ($1, 'analise', 'RUNNING', $2, 'Iniciando analise com IA (code)...', $3)
       RETURNING id`,
      [tenantId, session.user.id, JSON.stringify([{ time: new Date().toISOString(), message: "Analise disparada pelo dashboard (code)", level: "info" }])]
    );

    // Execute analysis directly (no N8N)
    const result = await executarAnalise(
      tenantId,
      execution?.id,
      async (msg) => {
        await query(
          `UPDATE workflow_executions SET current_step = $2 WHERE id = $1`,
          [execution?.id, msg]
        );
      }
    );

    // Trigger callback for status updates (review_phase, flywheel counters)
    if (result.success) {
      await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/n8n/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "ANALISE_EDITAIS",
          tenant_id: tenantId,
          status: "SUCCESS",
          execution_id: execution?.id,
          metrics: result.stats,
        }),
      });
    }

    return NextResponse.json({ success: result.success, execution_id: execution?.id, stats: result.stats, error: result.error });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

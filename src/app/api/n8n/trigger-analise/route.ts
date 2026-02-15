import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { triggerAnalise } from "@/lib/n8n/client";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = session.user.tenantId;

    // Check if there's already a running analysis for this tenant
    const running = await queryOne(
      `SELECT id FROM workflow_executions 
       WHERE tenant_id = $1 AND workflow_type = 'analise' AND status IN ('PENDING', 'RUNNING')`,
      [tenantId]
    );
    if (running) {
      return NextResponse.json({ error: "Já existe uma análise em andamento" }, { status: 409 });
    }

    // Create execution record
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
       VALUES ($1, 'analise', 'PENDING', $2, 'Iniciando análise com IA...', $3)
       RETURNING id`,
      [tenantId, session.user.id, JSON.stringify([{ time: new Date().toISOString(), message: "Análise disparada pelo dashboard", level: "info" }])]
    );

    // Trigger n8n webhook with execution_id
    const result = await triggerAnalise(tenantId, execution?.id);

    // Update to RUNNING
    await query(
      `UPDATE workflow_executions SET status = 'RUNNING', current_step = 'Carregando editais pendentes...' WHERE id = $1`,
      [execution?.id]
    );

    return NextResponse.json({ success: true, execution_id: execution?.id, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

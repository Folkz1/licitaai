import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { triggerBusca } from "@/lib/n8n/client";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = session.user.tenantId;

    // Check if there's already a running busca for this tenant
    const running = await queryOne(
      `SELECT id FROM workflow_executions 
       WHERE tenant_id = $1 AND workflow_type = 'busca' AND status IN ('PENDING', 'RUNNING')`,
      [tenantId]
    );
    if (running) {
      return NextResponse.json({ error: "Já existe uma busca em andamento" }, { status: 409 });
    }

    // Create execution record
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
       VALUES ($1, 'busca', 'PENDING', $2, 'Iniciando busca no PNCP...', $3)
       RETURNING id`,
      [tenantId, session.user.id, JSON.stringify([{ time: new Date().toISOString(), message: "Busca disparada pelo dashboard", level: "info" }])]
    );

    // Trigger n8n webhook with execution_id
    const result = await triggerBusca(tenantId, execution?.id);

    // Update to RUNNING
    await query(
      `UPDATE workflow_executions SET status = 'RUNNING', current_step = 'Conectando ao PNCP...' WHERE id = $1`,
      [execution?.id]
    );

    return NextResponse.json({ success: true, execution_id: execution?.id, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

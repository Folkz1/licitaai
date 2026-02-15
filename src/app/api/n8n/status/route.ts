import { getEffectiveTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/n8n/status?type=busca|analise|all
 * Returns the latest workflow executions for the tenant
 */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getEffectiveTenantId();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";

    const typeFilter = type === "all" ? "" : `AND workflow_type = '${type === "busca" ? "busca" : "analise"}'`;

    // APLICAR TIMEOUT: Finalizar execuções travadas há mais de 30 minutos
    await query(
      `UPDATE workflow_executions 
       SET status = 'ERROR', 
           error_message = 'Timeout: Execução expirada (30min)', 
           finished_at = NOW(),
           progress = 100
       WHERE status IN ('RUNNING', 'PENDING') 
       AND started_at < NOW() - INTERVAL '30 minutes'`
    );

    // Get active (running/pending) executions
    const active = await query(
      `SELECT id, workflow_type, status, progress, current_step, metrics, logs, started_at, finished_at, error_message
       FROM workflow_executions 
       WHERE tenant_id = $1 AND status IN ('PENDING', 'RUNNING') ${typeFilter}
       ORDER BY started_at DESC
       LIMIT 5`,
      [tenantId]
    );

    // Get last 5 completed executions
    const recent = await query(
      `SELECT id, workflow_type, status, progress, current_step, metrics, logs, started_at, finished_at, error_message
       FROM workflow_executions 
       WHERE tenant_id = $1 AND status NOT IN ('PENDING', 'RUNNING') ${typeFilter}
       ORDER BY finished_at DESC NULLS LAST
       LIMIT 5`,
      [tenantId]
    );

    return NextResponse.json({
      active,
      recent,
      has_running: active.length > 0,
    });
  } catch {
    return NextResponse.json({ active: [], recent: [], has_running: false });
  }
}

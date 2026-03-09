import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { executarBusca } from "@/lib/pncp/search";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 min

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = session.user.tenantId;

    // Check if there's already a running busca
    const running = await queryOne(
      `SELECT id FROM workflow_executions
       WHERE tenant_id = $1 AND workflow_type = 'busca' AND status IN ('PENDING', 'RUNNING')`,
      [tenantId]
    );
    if (running) {
      return NextResponse.json({ error: "Ja existe uma busca em andamento" }, { status: 409 });
    }

    // Create execution record
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
       VALUES ($1, 'busca', 'RUNNING', $2, 'Iniciando busca PNCP (code)...', $3)
       RETURNING id`,
      [tenantId, session.user.id, JSON.stringify([{ time: new Date().toISOString(), message: "Busca disparada pelo dashboard (code)", level: "info" }])]
    );

    // Execute search directly (no N8N)
    const result = await executarBusca(
      tenantId,
      execution?.id,
      async (msg) => {
        await query(
          `UPDATE workflow_executions SET current_step = $2 WHERE id = $1`,
          [execution?.id, msg]
        );
      }
    );

    // Trigger callback for slug generation etc.
    if (result.success) {
      await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/n8n/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "BUSCA_PNCP",
          tenant_id: tenantId,
          status: "SUCCESS",
          execution_id: execution?.id,
          metrics: result.stats,
        }),
      });
    }

    // Auto-cleanup: remove NOVA expiradas há >7 dias sem análise (nunca terão valor)
    if (result.success) {
      try {
        const cleaned = await query(
          `DELETE FROM licitacoes
           WHERE id IN (
             SELECT l.id FROM licitacoes l
             LEFT JOIN analises a ON a.licitacao_id = l.id
             WHERE l.tenant_id = $1
               AND l.review_phase = 'NOVA'
               AND a.id IS NULL
               AND l.data_encerramento_proposta < NOW() - INTERVAL '7 days'
           )`,
          [tenantId]
        );
        console.log(`[BUSCA] Auto-cleanup: licitações NOVA expiradas removidas`);
      } catch (cleanupErr) {
        // Limpeza não é crítica - não aborta o resultado
        console.error("[BUSCA] Auto-cleanup falhou:", cleanupErr);
      }
    }

    return NextResponse.json({ success: result.success, execution_id: execution?.id, stats: result.stats, error: result.error });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

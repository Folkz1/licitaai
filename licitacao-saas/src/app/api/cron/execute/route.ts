import { query, queryOne } from "@/lib/db";
import { executarAnalise } from "@/lib/pncp/analyze";
import { executarBusca } from "@/lib/pncp/search";
import { assertTenantOperationalAccess } from "@/lib/trial";
import { NextRequest, NextResponse } from "next/server";

// Unified cron: BUSCA + ANALISE run sequentially as a single workflow.
// Called every 15 minutes by external cron to check which schedules are due.
//
// Flow per tenant: Busca PNCP → Análise IA (one execution record)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.N8N_WEBHOOK_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: { tenant_id: string; workflow: string; status: string; error?: string }[] = [];

  // Cleanup: mark stale RUNNING executions as ERROR (stuck > 45min)
  try {
    const staleCount = await query(
      `UPDATE workflow_executions SET status = 'ERROR', finished_at = NOW(),
        error_message = 'Timeout: Execução expirada (45min)',
        current_step = 'Timeout: execucao expirada'
      WHERE status = 'RUNNING' AND started_at < NOW() - INTERVAL '45 minutes'
      RETURNING id`
    );
    if (staleCount.length > 0) {
      console.log(`[CRON] Cleaned up ${staleCount.length} stale RUNNING executions`);
    }
  } catch { /* non-critical */ }

  // Find unique tenants with due schedules (deduplicate BUSCA+ANALISE into one run)
  const dueSchedules = await query<{
    id: string;
    tenant_id: string;
    workflow: string;
    frequency: string;
    hour: number;
    minute: number;
    days_of_week: number[];
    params: Record<string, unknown>;
    next_run_at: string | null;
  }>(
    `SELECT id, tenant_id, workflow, frequency, hour, minute, days_of_week, params, next_run_at
     FROM cron_schedules
     WHERE enabled = TRUE
       AND (next_run_at IS NULL OR next_run_at <= $1)`,
    [now.toISOString()]
  );

  // Group by tenant - we run one unified workflow per tenant
  const tenantSchedules = new Map<string, typeof dueSchedules>();
  for (const schedule of dueSchedules) {
    const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentHour = spNow.getHours();
    const currentMinute = spNow.getMinutes();
    const currentDay = spNow.getDay();

    const isPastDue = schedule.next_run_at && new Date(schedule.next_run_at) <= now;
    const timeMatches =
      schedule.days_of_week.includes(currentDay) &&
      currentHour === schedule.hour &&
      currentMinute >= schedule.minute &&
      currentMinute < schedule.minute + 15;

    if (!isPastDue && !timeMatches) continue;

    const list = tenantSchedules.get(schedule.tenant_id) || [];
    list.push(schedule);
    tenantSchedules.set(schedule.tenant_id, list);
  }

  // Execute unified workflow per tenant: BUSCA → ANALISE
  for (const [tenantId, schedules] of tenantSchedules) {
    let executionId: string | undefined;
    const hasBusca = schedules.some(s => s.workflow === "BUSCA_PNCP");
    const hasAnalise = schedules.some(s => s.workflow === "ANALISE_EDITAIS");
    const analiseSchedule = schedules.find(s => s.workflow === "ANALISE_EDITAIS");
    const workflowLabel = hasBusca && hasAnalise ? "busca+analise" : hasBusca ? "busca" : "analise";

    try {
      await assertTenantOperationalAccess(tenantId, hasBusca ? "search" : "analysis");

      // Create single execution record for the unified workflow
      const execution = await queryOne<{ id: string }>(
        `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
         VALUES ($1, $2, 'RUNNING', NULL, $3, $4)
         RETURNING id`,
        [
          tenantId,
          workflowLabel,
          `Iniciando ${workflowLabel} (cron)...`,
          JSON.stringify([{ time: new Date().toISOString(), message: `${workflowLabel} disparado pelo cron`, level: "info" }]),
        ]
      );
      executionId = execution?.id;

      let buscaStats = null;
      let analiseStats = null;

      // Step 1: BUSCA (if due)
      if (hasBusca) {
        await appendLog(executionId, "Etapa 1: Busca PNCP...");
        buscaStats = await executarBusca(tenantId, executionId);
        await appendLog(executionId, `Busca concluida: ${buscaStats.stats.aprovadas} aprovadas de ${buscaStats.stats.total_recebidas} recebidas`);
      }

      // Step 2: ANALISE (if due - runs right after busca)
      if (hasAnalise) {
        const maxLic = (analiseSchedule?.params?.max_licitacoes as number) || 20;
        // Cap at 15 per batch - each can take 1-5 min (OCR + RAG + LLM)
        const safeBatch = Math.min(maxLic, 15);
        await appendLog(executionId, `Etapa 2: Analise IA (batch ${safeBatch})...`);
        analiseStats = await executarAnalise(tenantId, executionId, undefined, safeBatch);
        await appendLog(executionId, `Analise concluida: ${analiseStats.stats.analisadas} analisadas, ${analiseStats.stats.pre_triagem_rejeitadas} rejeitadas`);
      }

      // Mark execution as SUCCESS
      if (executionId) {
        const metrics = {
          busca: buscaStats?.stats || null,
          analise: analiseStats?.stats || null,
        };
        await query(
          `UPDATE workflow_executions SET
            status = 'SUCCESS', finished_at = NOW(), progress = 100,
            current_step = $2,
            metrics = $3::jsonb
          WHERE id = $1`,
          [
            executionId,
            `${workflowLabel} concluido`,
            JSON.stringify(metrics),
          ]
        );
      }

      // Update all schedules for this tenant
      for (const schedule of schedules) {
        const nextRun = calculateNextRun(schedule);
        await query(
          `UPDATE cron_schedules
           SET last_run_at = $1, last_status = 'SUCCESS', next_run_at = $2, run_count = run_count + 1, updated_at = NOW()
           WHERE id = $3`,
          [now.toISOString(), nextRun.toISOString(), schedule.id]
        );
      }

      results.push({ tenant_id: tenantId, workflow: workflowLabel, status: "triggered" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";

      if (executionId) {
        try {
          await query(
            `UPDATE workflow_executions SET status = 'ERROR', finished_at = NOW(),
              error_message = $2,
              current_step = $3,
              logs = COALESCE(logs, '[]'::jsonb) || $4::jsonb
            WHERE id = $1 AND status = 'RUNNING'`,
            [
              executionId,
              msg.slice(0, 500),
              `Erro: ${msg.slice(0, 200)}`,
              JSON.stringify([{ time: new Date().toISOString(), message: msg, level: "error" }]),
            ]
          );
        } catch { /* don't fail the schedule update */ }
      }

      for (const schedule of schedules) {
        await query(
          `UPDATE cron_schedules SET last_status = $1, updated_at = NOW() WHERE id = $2`,
          [`ERROR: ${msg.slice(0, 200)}`, schedule.id]
        );
      }

      results.push({ tenant_id: tenantId, workflow: workflowLabel, status: "error", error: msg });
    }
  }

  return NextResponse.json({
    checked: dueSchedules.length,
    triggered: results.filter((r) => r.status === "triggered").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
    timestamp: now.toISOString(),
  });
}

async function appendLog(executionId: string | undefined, message: string) {
  if (!executionId) return;
  try {
    await query(
      `UPDATE workflow_executions SET
        current_step = $2,
        logs = COALESCE(logs, '[]'::jsonb) || $3::jsonb
      WHERE id = $1`,
      [executionId, message.slice(0, 500), JSON.stringify([{ time: new Date().toISOString(), message, level: "info" }])]
    );
  } catch { /* never break pipeline */ }
}

function calculateNextRun(schedule: {
  frequency: string;
  hour: number;
  minute: number;
  days_of_week: number[];
}): Date {
  const now = new Date();
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

  if (schedule.frequency === "HOURLY") {
    const next = new Date(spNow);
    next.setHours(next.getHours() + 1);
    next.setMinutes(schedule.minute, 0, 0);
    return next;
  }

  // For DAILY/WEEKLY: find the next matching day
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(spNow);
    candidate.setDate(candidate.getDate() + daysAhead);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);

    const candidateDay = candidate.getDay();
    if (schedule.days_of_week.includes(candidateDay)) {
      return candidate;
    }
  }

  const tomorrow = new Date(spNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(schedule.hour, schedule.minute, 0, 0);
  return tomorrow;
}

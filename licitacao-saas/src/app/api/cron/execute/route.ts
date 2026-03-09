import { query, queryOne } from "@/lib/db";
import { executarAnalise } from "@/lib/pncp/analyze";
import { executarBusca } from "@/lib/pncp/search";
import { NextRequest, NextResponse } from "next/server";

// This endpoint is called by an external cron (Vercel Cron, EasyPanel cron, etc.)
// every 15 minutes to check which tenant schedules are due and trigger them.
//
// Setup options:
// 1. Vercel Cron: add to vercel.json: { "crons": [{ "path": "/api/cron/execute", "schedule": "*/15 * * * *" }] }
// 2. External: curl -H "Authorization: Bearer SECRET" https://your-app.com/api/cron/execute
// 3. EasyPanel: add a cron job that hits this endpoint

export async function GET(req: NextRequest) {
  // Auth: either Vercel Cron header or Bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.N8N_WEBHOOK_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: { tenant_id: string; workflow: string; status: string; error?: string }[] = [];

  // Cleanup: mark stale RUNNING executions as ERROR (stuck > 30min)
  try {
    const staleCount = await query(
      `UPDATE workflow_executions SET status = 'ERROR', finished_at = NOW(),
        error_message = 'Timeout: Execução expirada (30min)',
        current_step = 'Timeout: execucao expirada'
      WHERE status = 'RUNNING' AND started_at < NOW() - INTERVAL '30 minutes'
      RETURNING id`
    );
    if (staleCount.length > 0) {
      console.log(`[CRON] Cleaned up ${staleCount.length} stale RUNNING executions`);
    }
  } catch { /* non-critical */ }

  // Find all schedules that are due (next_run_at <= now OR next_run_at is null and should run now)
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

  for (const schedule of dueSchedules) {
    // Check if current time matches the schedule (hour/minute within 15min window, correct day)
    const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentHour = spNow.getHours();
    const currentMinute = spNow.getMinutes();
    const currentDay = spNow.getDay(); // 0=Sun, 1=Mon...

    // If next_run_at was set and is past due, run it regardless of time match
    const isPastDue = schedule.next_run_at && new Date(schedule.next_run_at) <= now;

    // Otherwise check if the time roughly matches (within 15-min execution window)
    const timeMatches =
      schedule.days_of_week.includes(currentDay) &&
      currentHour === schedule.hour &&
      currentMinute >= schedule.minute &&
      currentMinute < schedule.minute + 15;

    if (!isPastDue && !timeMatches) {
      continue;
    }

    let executionId: string | undefined;
    try {
      if (schedule.workflow === "BUSCA_PNCP") {
        // Create execution record
        const execution = await queryOne<{ id: string }>(
          `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
           VALUES ($1, 'busca', 'RUNNING', NULL, 'Iniciando busca PNCP (code)...', $2)
           RETURNING id`,
          [schedule.tenant_id, JSON.stringify([{ time: new Date().toISOString(), message: "Busca disparada pelo cron (code)", level: "info" }])]
        );
        executionId = execution?.id;

        // Execute search directly (no N8N dependency)
        await executarBusca(schedule.tenant_id, executionId);
      } else if (schedule.workflow === "ANALISE_EDITAIS") {
        // Create execution record
        const execution = await queryOne<{ id: string }>(
          `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
           VALUES ($1, 'analise', 'RUNNING', NULL, 'Iniciando analise com IA (cron/code)...', $2)
           RETURNING id`,
          [schedule.tenant_id, JSON.stringify([{ time: new Date().toISOString(), message: "Analise disparada pelo cron (code)", level: "info" }])]
        );
        executionId = execution?.id;

        // Pass max_licitacoes from schedule params (default 20)
        const maxLic = (schedule.params?.max_licitacoes as number) || 20;
        // Cap at 30 per execution to avoid timeouts (each analysis can take 1-3 min)
        const safeBatch = Math.min(maxLic, 30);
        await executarAnalise(schedule.tenant_id, executionId, undefined, safeBatch);
      }

      // Update schedule: set last_run, increment count, calculate next_run
      const nextRun = calculateNextRun(schedule);
      await query(
        `UPDATE cron_schedules
         SET last_run_at = $1, last_status = 'SUCCESS', next_run_at = $2, run_count = run_count + 1, updated_at = NOW()
         WHERE id = $3`,
        [now.toISOString(), nextRun.toISOString(), schedule.id]
      );

      results.push({ tenant_id: schedule.tenant_id, workflow: schedule.workflow, status: "triggered" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";

      // Update workflow_execution to ERROR (prevents ghost RUNNING records)
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

      await query(
        `UPDATE cron_schedules SET last_status = $1, updated_at = NOW() WHERE id = $2`,
        [`ERROR: ${msg.slice(0, 200)}`, schedule.id]
      );

      results.push({ tenant_id: schedule.tenant_id, workflow: schedule.workflow, status: "error", error: msg });
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

function calculateNextRun(schedule: {
  frequency: string;
  hour: number;
  minute: number;
  days_of_week: number[];
}): Date {
  const now = new Date();
  // Work in Sao Paulo timezone
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

  // Fallback: tomorrow at the scheduled time
  const tomorrow = new Date(spNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(schedule.hour, schedule.minute, 0, 0);
  return tomorrow;
}

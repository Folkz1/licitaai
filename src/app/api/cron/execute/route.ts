import { query, queryOne } from "@/lib/db";
import { triggerBusca, triggerAnalise } from "@/lib/n8n/client";
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
  
  // Debug log
  console.log('[CRON] Auth header:', authHeader ? authHeader.substring(0, 20) + '...' : 'null');
  console.log('[CRON] Cron secret env:', cronSecret ? 'set' : 'NOT SET');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[CRON] Unauthorized - secret mismatch');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: { tenant_id: string; workflow: string; status: string; error?: string }[] = [];

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

    try {
      if (schedule.workflow === "BUSCA_PNCP") {
        // Create execution record
        const execution = await queryOne<{ id: string }>(
          `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
           VALUES ($1, 'busca', 'PENDING', NULL, 'Iniciando busca no PNCP (cron)...', $2)
           RETURNING id`,
          [schedule.tenant_id, JSON.stringify([{ time: new Date().toISOString(), message: "Busca disparada pelo cron", level: "info" }])]
        );

        // Trigger n8n webhook with execution_id
        await triggerBusca(schedule.tenant_id, execution?.id);

        // Update to RUNNING
        await query(
          `UPDATE workflow_executions SET status = 'RUNNING', current_step = 'Conectando ao PNCP...' WHERE id = $1`,
          [execution?.id]
        );
      } else if (schedule.workflow === "ANALISE_EDITAIS") {
        // Create execution record
        const execution = await queryOne<{ id: string }>(
          `INSERT INTO workflow_executions (tenant_id, workflow_type, status, triggered_by, current_step, logs)
           VALUES ($1, 'analise', 'PENDING', NULL, 'Iniciando análise com IA (cron)...', $2)
           RETURNING id`,
          [schedule.tenant_id, JSON.stringify([{ time: new Date().toISOString(), message: "Análise disparada pelo cron", level: "info" }])]
        );

        // Trigger n8n webhook with execution_id
        await triggerAnalise(schedule.tenant_id, execution?.id);

        // Update to RUNNING
        await query(
          `UPDATE workflow_executions SET status = 'RUNNING', current_step = 'Carregando editais pendentes...' WHERE id = $1`,
          [execution?.id]
        );
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

import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedules = await query(
    `SELECT id, workflow, enabled, frequency, hour, minute, days_of_week, timezone, params,
            last_run_at, last_status, next_run_at, run_count
     FROM cron_schedules
     WHERE tenant_id = $1
     ORDER BY workflow`,
    [tenantId]
  );

  return NextResponse.json(schedules);
}

export async function PUT(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workflow, enabled, frequency, hour, minute, days_of_week, params } = await req.json();

  // Calculate next_run_at based on new schedule
  const nextRun = enabled ? calculateNextRunFromNow({ frequency, hour, minute, days_of_week }) : null;

  const schedule = await queryOne(
    `INSERT INTO cron_schedules (tenant_id, workflow, enabled, frequency, hour, minute, days_of_week, params, next_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (tenant_id, workflow) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       frequency = EXCLUDED.frequency,
       hour = EXCLUDED.hour,
       minute = EXCLUDED.minute,
       days_of_week = EXCLUDED.days_of_week,
       params = EXCLUDED.params,
       next_run_at = EXCLUDED.next_run_at,
       updated_at = NOW()
     RETURNING *`,
    [
      tenantId,
      workflow,
      enabled,
      frequency,
      hour,
      minute,
      `{${days_of_week.join(",")}}`,
      JSON.stringify(params || {}),
      nextRun?.toISOString() || null,
    ]
  );

  return NextResponse.json(schedule);
}

function calculateNextRunFromNow(schedule: {
  frequency: string;
  hour: number;
  minute: number;
  days_of_week: number[];
}): Date {
  const now = new Date();

  if (schedule.frequency === "HOURLY") {
    const next = new Date(now);
    next.setHours(next.getHours() + 1);
    next.setMinutes(schedule.minute, 0, 0);
    return next;
  }

  for (let d = 0; d <= 7; d++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + d);
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);

    if (candidate <= now) continue;
    if (schedule.days_of_week.includes(candidate.getDay())) {
      return candidate;
    }
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(schedule.hour, schedule.minute, 0, 0);
  return tomorrow;
}

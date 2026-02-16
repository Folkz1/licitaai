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
<<<<<<< HEAD
    `SELECT cs.id, cs.workflow, cs.enabled, cs.frequency, cs.hour, cs.minute, cs.days_of_week, cs.timezone, cs.params,
            cs.last_run_at, cs.last_status, cs.next_run_at, cs.run_count, cs.config_id,
            cb.nome as config_nome
     FROM cron_schedules cs
     LEFT JOIN configuracoes_busca cb ON cb.id = cs.config_id
     WHERE cs.tenant_id = $1
     ORDER BY cs.workflow, cb.nome`,
=======
    `SELECT id, workflow, enabled, frequency, hour, minute, days_of_week, timezone, params,
            last_run_at, last_status, next_run_at, run_count
     FROM cron_schedules
     WHERE tenant_id = $1
     ORDER BY workflow`,
>>>>>>> master
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

<<<<<<< HEAD
  const body = await req.json();
  const { id, workflow, config_id, enabled, frequency, hour, minute, days_of_week, params } = body;
=======
  const { workflow, enabled, frequency, hour, minute, days_of_week, params } = await req.json();
>>>>>>> master

  // Calculate next_run_at based on new schedule
  const nextRun = enabled ? calculateNextRunFromNow({ frequency, hour, minute, days_of_week }) : null;

<<<<<<< HEAD
  if (id) {
    // Update existing schedule
    await query(
      `UPDATE cron_schedules SET
        config_id = $1,
        enabled = $2,
        frequency = $3,
        hour = $4,
        minute = $5,
        days_of_week = $6,
        params = $7,
        next_run_at = $8,
        updated_at = NOW()
       WHERE id = $9 AND tenant_id = $10`,
      [
        config_id,
        enabled,
        frequency,
        hour,
        minute,
        `{${days_of_week.join(",")}}`,
        JSON.stringify(params || {}),
        nextRun?.toISOString() || null,
        id,
        tenantId
      ]
    );
  } else {
    // Create new schedule
    await query(
      `INSERT INTO cron_schedules (tenant_id, config_id, workflow, enabled, frequency, hour, minute, days_of_week, params, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id, workflow, COALESCE(config_id, 0)) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         frequency = EXCLUDED.frequency,
         hour = EXCLUDED.hour,
         minute = EXCLUDED.minute,
         days_of_week = EXCLUDED.days_of_week,
         params = EXCLUDED.params,
         next_run_at = EXCLUDED.next_run_at,
         updated_at = NOW()`,
      [
        tenantId,
        config_id,
        workflow || 'BUSCA_PNCP',
        enabled ?? true,
        frequency || 'DAILY',
        hour || 6,
        minute || 0,
        days_of_week || [1, 2, 3, 4, 5],
        JSON.stringify(params || {}),
        nextRun?.toISOString() || null,
      ]
    );
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { config_id, workflow, enabled, frequency, hour, minute, days_of_week, params } = body;

  const nextRun = enabled ? calculateNextRunFromNow({ frequency, hour, minute, days_of_week }) : null;

  await query(
    `INSERT INTO cron_schedules (tenant_id, config_id, workflow, enabled, frequency, hour, minute, days_of_week, params, next_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      tenantId,
      config_id,
      workflow || 'BUSCA_PNCP',
      enabled ?? true,
      frequency || 'DAILY',
      hour || 6,
      minute || 0,
      days_of_week || [1, 2, 3, 4, 5],
=======
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
>>>>>>> master
      JSON.stringify(params || {}),
      nextRun?.toISOString() || null,
    ]
  );

<<<<<<< HEAD
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await query("DELETE FROM cron_schedules WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  }

  return NextResponse.json({ success: true });
=======
  return NextResponse.json(schedule);
>>>>>>> master
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

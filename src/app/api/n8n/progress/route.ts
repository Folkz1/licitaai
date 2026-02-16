import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * n8n calls this endpoint to update workflow progress in real-time.
 * POST /api/n8n/progress
 * Body: { execution_id, progress, current_step, metrics?, log_message?, status? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { execution_id, progress, current_step, metrics, log_message, log_level, status } = body;

    if (!execution_id) {
      return NextResponse.json({ error: "execution_id required" }, { status: 400 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (progress !== undefined) {
      updates.push(`progress = $${idx++}`);
      values.push(Math.min(100, Math.max(0, progress)));
    }
    if (current_step) {
      updates.push(`current_step = $${idx++}`);
      values.push(current_step);
    }
    if (metrics) {
      updates.push(`metrics = COALESCE(metrics, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(JSON.stringify(metrics));
    }
    if (status) {
      updates.push(`status = $${idx++}`);
      values.push(status);
      if (status === "SUCCESS" || status === "ERROR") {
        updates.push(`finished_at = NOW()`);
      }
    }

    // Append log message
    if (log_message) {
      const logEntry = JSON.stringify({
        time: new Date().toISOString(),
        message: log_message,
        level: log_level || "info",
      });
      updates.push(`logs = COALESCE(logs, '[]'::jsonb) || $${idx++}::jsonb`);
      values.push(`[${logEntry}]`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ ok: true });
    }

    values.push(execution_id);
    await query(
      `UPDATE workflow_executions SET ${updates.join(", ")} WHERE id = $${idx}`,
      values
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Progress update error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

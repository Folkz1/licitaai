import { auth } from "@/lib/auth";
import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Auto-create table on first use
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, read, created_at DESC)`);
  tableReady = true;
}

/**
 * GET /api/notifications — list unread + recent notifications
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTable();

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  const rows = await query<{
    id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    read: boolean;
    created_at: string;
  }>(
    `SELECT id, type, title, message, link, read, created_at
     FROM notifications
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );

  const unreadCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications WHERE tenant_id = $1 AND read = false`,
    [tenantId]
  );

  return NextResponse.json({
    notifications: rows,
    unread: parseInt(unreadCount?.count || "0"),
  });
}

/**
 * POST /api/notifications — create a notification (internal use)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTable();

  const body = await req.json();
  const { type = "info", title, message, link } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const row = await queryOne<{ id: string }>(
    `INSERT INTO notifications (tenant_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, type, title, message || null, link || null]
  );

  return NextResponse.json({ id: row?.id });
}

/**
 * PATCH /api/notifications — mark as read
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let tenantId: string;
  try {
    ({ tenantId } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTable();

  const body = await req.json();
  const { id, all } = body;

  if (all) {
    await query(
      `UPDATE notifications SET read = true WHERE tenant_id = $1 AND read = false`,
      [tenantId]
    );
  } else if (id) {
    await query(
      `UPDATE notifications SET read = true WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
  }

  return NextResponse.json({ ok: true });
}

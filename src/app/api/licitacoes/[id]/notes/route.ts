import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tenantId = session.user.tenantId;

  const notes = await query(
    `SELECT ra.id, ra.action, ra.from_phase, ra.to_phase, ra.note, ra.created_at,
            u.nome as user_name
     FROM review_actions ra
     LEFT JOIN users u ON u.id = ra.user_id
     WHERE ra.licitacao_id = $1 AND ra.tenant_id = $2
     ORDER BY ra.created_at DESC`,
    [id, tenantId]
  );

  return NextResponse.json(notes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { note } = await req.json();
  const tenantId = session.user.tenantId;
  const userId = session.user.id;

  await query(
    `INSERT INTO review_actions (licitacao_id, tenant_id, user_id, action, note)
     VALUES ($1, $2, $3, 'NOTE', $4)`,
    [id, tenantId, userId, note]
  );

  return NextResponse.json({ success: true });
}

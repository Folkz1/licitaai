import { getEffectiveTenantId } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let tenantId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any;
  try {
    ({ tenantId, session } = await getEffectiveTenantId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, toPhase, note, assignedTo } = body;

  const userId = session.user.id;

  // Get current phase
  const licitacao = await queryOne<{ review_phase: string }>(
    "SELECT review_phase FROM licitacoes WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );

  if (!licitacao) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fromPhase = licitacao.review_phase;

  // Update licitacao
  if (toPhase) {
    await query(
      `UPDATE licitacoes SET review_phase = $1, updated_at = NOW()
       ${assignedTo ? ", assigned_to = '" + assignedTo + "'" : ""}
       ${note ? ", review_notes = COALESCE(review_notes, '') || E'\\n' || '" + note.replace(/'/g, "''") + "'" : ""}
       WHERE id = $2 AND tenant_id = $3`,
      [toPhase, id, tenantId]
    );
  }

  // Record action
  await query(
    `INSERT INTO review_actions (licitacao_id, tenant_id, user_id, action, from_phase, to_phase, note, assigned_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, tenantId, userId, action, fromPhase, toPhase || fromPhase, note || null, assignedTo || null]
  );

  return NextResponse.json({ success: true });
}

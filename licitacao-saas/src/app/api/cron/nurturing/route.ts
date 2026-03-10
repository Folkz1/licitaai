import { query, queryOne } from "@/lib/db";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "licitai-cron-2026";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get pending sequences that are due
  const sequences = await query<{
    id: string;
    lead_id: string;
    step: number;
    message_text: string;
  }>(
    `SELECT ls.id, ls.lead_id, ls.step, ls.message_text
     FROM lead_sequences ls
     JOIN portal_leads pl ON pl.id = ls.lead_id
     WHERE ls.status = 'pending'
       AND ls.scheduled_at <= NOW()
       AND pl.opted_out = false
     ORDER BY ls.scheduled_at ASC
     LIMIT 20`
  );

  let sent = 0;
  let failed = 0;

  for (const seq of sequences) {
    const lead = await queryOne<{ telefone: string; nome: string }>(
      "SELECT telefone, nome FROM portal_leads WHERE id = $1",
      [seq.lead_id]
    );

    if (!lead?.telefone) {
      await query(
        "UPDATE lead_sequences SET status = 'skipped', error = 'no phone' WHERE id = $1",
        [seq.id]
      );
      continue;
    }

    const success = await sendWhatsApp(lead.telefone, seq.message_text || "");

    if (success) {
      await query(
        `UPDATE lead_sequences SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [seq.id]
      );
      await query(
        `UPDATE portal_leads SET last_contacted_at = NOW(), sequence_step = $2, updated_at = NOW() WHERE id = $1`,
        [seq.lead_id, seq.step]
      );
      sent++;
    } else {
      await query(
        "UPDATE lead_sequences SET status = 'failed', error = 'send failed' WHERE id = $1",
        [seq.id]
      );
      failed++;
    }

    // Rate limit: 3s between messages
    if (sequences.indexOf(seq) < sequences.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  return NextResponse.json({
    ok: true,
    processed: sequences.length,
    sent,
    failed,
  });
}

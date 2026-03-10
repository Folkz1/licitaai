import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const OPT_OUT_KEYWORDS = ["parar", "cancelar", "sair", "não quero", "nao quero", "pare", "stop"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Evolution API webhook payload
    const message =
      body?.data?.message?.conversation ||
      body?.data?.message?.extendedTextMessage?.text ||
      "";
    const remoteJid = body?.data?.key?.remoteJid || "";

    if (!message || !remoteJid) {
      return NextResponse.json({ ok: true });
    }

    const phone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    const lowerMsg = message.toLowerCase().trim();

    const isOptOut = OPT_OUT_KEYWORDS.some((kw) => lowerMsg.includes(kw));

    if (isOptOut) {
      // Mark lead as opted out
      await query(
        `UPDATE portal_leads SET opted_out = true, status = 'perdido', updated_at = NOW()
         WHERE telefone LIKE $1`,
        [`%${phone.slice(-11)}`]
      );

      // Cancel pending sequences
      await query(
        `UPDATE lead_sequences SET status = 'skipped'
         WHERE lead_id IN (SELECT id FROM portal_leads WHERE telefone LIKE $1)
           AND status = 'pending'`,
        [`%${phone.slice(-11)}`]
      );
    }

    return NextResponse.json({ ok: true, optOut: isOptOut });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

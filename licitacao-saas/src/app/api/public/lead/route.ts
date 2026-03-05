import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { notifyNewLead } from "@/lib/evolution";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, email, telefone, empresa, interesse, source_url, source_slug, utm_source, utm_medium, utm_campaign } = body;

    if (!nome || !email) {
      return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

    // Save lead
    await query(
      `INSERT INTO portal_leads (nome, email, telefone, empresa, interesse, source_url, source_slug, utm_source, utm_medium, utm_campaign, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [nome, email, telefone || null, empresa || null, interesse || null, source_url || null, source_slug || null, utm_source || null, utm_medium || null, utm_campaign || null, ipHash]
    );

    // Notify Diego via WhatsApp (fire and forget)
    notifyNewLead({ nome, email, telefone, empresa, interesse, source_slug }).catch(() => {});

    // Return analysis preview as "reward" if source_slug provided
    let preview = null;
    if (source_slug) {
      const result = await query<{
        prioridade: string;
        score_relevancia: number;
        justificativa: string;
      }>(
        `SELECT a.prioridade, a.score_relevancia, a.justificativa
         FROM analises a
         JOIN licitacoes l ON l.id = a.licitacao_id
         WHERE l.slug = $1
         LIMIT 1`,
        [source_slug]
      );
      if (result.length > 0) {
        preview = {
          prioridade: result[0].prioridade,
          score: result[0].score_relevancia,
          justificativa: result[0].justificativa?.slice(0, 300),
        };
      }
    }

    return NextResponse.json({ success: true, preview });
  } catch (err) {
    console.error("[LEAD] Error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

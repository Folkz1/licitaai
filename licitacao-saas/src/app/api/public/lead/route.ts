import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { notifyNewLead } from "@/lib/evolution";
import { createNurturingSequence } from "@/lib/nurturing";
import { PORTAL_PUBLIC_TENANT_ID } from "@/lib/portal";
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
    const lead = await queryOne<{ id: string }>(
      `INSERT INTO portal_leads (nome, email, telefone, empresa, interesse, source_url, source_slug, utm_source, utm_medium, utm_campaign, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [nome, email, telefone || null, empresa || null, interesse || null, source_url || null, source_slug || null, utm_source || null, utm_medium || null, utm_campaign || null, ipHash]
    );

    // Notify Diego via WhatsApp (fire and forget)
    notifyNewLead({ nome, email, telefone, empresa, interesse, source_slug }).catch(() => {});

    // Start nurturing sequence if lead has phone (fire and forget)
    if (lead?.id && telefone) {
      createNurturingSequence(lead.id).catch((err) =>
        console.error("[LEAD] Nurturing error:", err)
      );
    }

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
         JOIN licitacoes origem ON origem.id = a.licitacao_id
         JOIN licitacoes portal
           ON portal.numero_controle_pncp = origem.numero_controle_pncp
          AND portal.tenant_id = $2
         WHERE portal.slug = $1
         LIMIT 1`,
        [source_slug, PORTAL_PUBLIC_TENANT_ID]
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

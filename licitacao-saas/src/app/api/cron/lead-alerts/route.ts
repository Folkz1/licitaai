import { query } from "@/lib/db";
import { sendWhatsApp } from "@/lib/whatsapp";
import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "licitai-cron-2026";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://licitai.mbest.site";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get leads with interest keywords who aren't converted/opted out
  const leads = await query<{
    id: string;
    nome: string;
    telefone: string;
    interest_keywords: string[];
    interest_uf: string | null;
  }>(
    `SELECT id, nome, telefone, interest_keywords, interest_uf
     FROM portal_leads
     WHERE status NOT IN ('convertido', 'perdido')
       AND opted_out = false
       AND interest_keywords IS NOT NULL
       AND telefone IS NOT NULL
     LIMIT 50`
  );

  let alertsSent = 0;

  for (const lead of leads) {
    const likePatterns = lead.interest_keywords.map((k) => `%${k}%`);

    const licitacoes = await query<{
      orgao_nome: string;
      objeto_compra: string;
      valor_total_estimado: number;
      uf: string;
      slug: string;
    }>(
      `SELECT orgao_nome, objeto_compra, valor_total_estimado, uf, slug
       FROM licitacoes
       WHERE data_publicacao >= NOW() - INTERVAL '3 days'
         AND (objeto_compra ILIKE ANY($1))
         ${lead.interest_uf ? "AND UPPER(uf) = $2" : ""}
       ORDER BY valor_total_estimado DESC NULLS LAST
       LIMIT 3`,
      lead.interest_uf ? [likePatterns, lead.interest_uf] : [likePatterns]
    );

    if (licitacoes.length === 0) continue;

    const nome = lead.nome.split(" ")[0];
    const lista = licitacoes
      .map((l) => {
        const valor = l.valor_total_estimado
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(l.valor_total_estimado)
          : "Valor não informado";
        return `- ${l.objeto_compra?.slice(0, 80)} | ${valor} | ${l.uf}`;
      })
      .join("\n");

    const keyword = encodeURIComponent(lead.interest_keywords[0] || "");
    const msg = `${nome}, encontrei ${licitacoes.length} licitações novas no seu segmento!\n\n${lista}\n\nVer todas: ${APP_URL}/editais?q=${keyword}`;

    const success = await sendWhatsApp(lead.telefone, msg);

    if (success) {
      for (const lic of licitacoes) {
        await query(
          `INSERT INTO lead_alerts (lead_id, match_reason, status, sent_at) VALUES ($1, $2, 'sent', NOW())`,
          [lead.id, lic.objeto_compra?.slice(0, 200)]
        );
      }
      alertsSent++;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 3000));
  }

  return NextResponse.json({ ok: true, leadsChecked: leads.length, alertsSent });
}

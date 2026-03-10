import { query, queryOne } from "@/lib/db";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCGUuQIUL3M7bl8N6Aq82CriDVuKdLCrII";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://licitai.mbest.site";

interface Lead {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  interesse: string | null;
  interest_keywords: string[] | null;
  interest_uf: string | null;
}

async function extractKeywords(interesse: string): Promise<{ keywords: string[]; uf: string | null }> {
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Extraia do texto de interesse de um lead de licitações: "${interesse}". Retorne JSON: {"keywords": ["palavra1", "palavra2"], "uf": "SP" ou null}. Keywords devem ser termos de busca curtos relevantes para licitações.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 256, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { keywords: [], uf: null };
    const parsed = JSON.parse(text);
    return { keywords: parsed.keywords || [], uf: parsed.uf || null };
  } catch {
    return { keywords: interesse.split(/\s+/).filter((w) => w.length > 3).slice(0, 5), uf: null };
  }
}

export async function createNurturingSequence(leadId: string): Promise<void> {
  const lead = await queryOne<Lead>(
    "SELECT id, nome, email, telefone, empresa, interesse, interest_keywords, interest_uf FROM portal_leads WHERE id = $1",
    [leadId]
  );
  if (!lead || !lead.telefone) return;

  // Extract keywords if not already done
  let keywords = lead.interest_keywords || [];
  let uf = lead.interest_uf || null;

  if (keywords.length === 0 && lead.interesse) {
    const extracted = await extractKeywords(lead.interesse);
    keywords = extracted.keywords;
    uf = extracted.uf;

    await query(
      "UPDATE portal_leads SET interest_keywords = $1, interest_uf = $2, updated_at = NOW() WHERE id = $3",
      [keywords, uf, leadId]
    );
  }

  // Count matching licitações
  const likePatterns = keywords.map((k) => `%${k}%`);
  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::TEXT as total FROM licitacoes
     WHERE (objeto_compra ILIKE ANY($1))
     ${uf ? "AND UPPER(uf) = $2" : ""}`,
    uf ? [likePatterns, uf] : [likePatterns]
  );
  const count = Number(countRow?.total || "0");

  const interestEncoded = encodeURIComponent(keywords[0] || lead.interesse || "");
  const nome = lead.nome.split(" ")[0];
  const interesse = keywords.join(", ") || lead.interesse || "licitações";

  // Step 1 - immediate
  const msg1 = `Olá ${nome}! Aqui é o Diego do LicitaIA.\n\nVi que você se interessou por licitações de ${interesse}.\n\nTemos ${count} editais abertos no seu segmento agora — a IA do LicitaIA analisa cada um e te diz quais valem a pena.\n\nVeja: ${APP_URL}/editais?q=${interestEncoded}\n\nQualquer dúvida, responde aqui!`;

  // Step 2 - +3 days
  const msg2 = `${nome}, novas licitações foram publicadas na sua área nos últimos dias!\n\nNossos clientes economizam em média 4h/dia de busca manual.\n\nQuer testar grátis? ${APP_URL}/onboarding`;

  // Step 3 - +7 days
  const msg3 = `Última mensagem, ${nome}!\n\nO plano Starter (R$197/mês) inclui:\n- Busca automática diária\n- Análise IA de cada edital\n- Alertas personalizados\n\n${APP_URL}/onboarding\n\nOu responde aqui se tiver dúvidas!`;

  // Insert sequences
  await query(
    `INSERT INTO lead_sequences (lead_id, step, channel, status, scheduled_at, message_text) VALUES
     ($1, 1, 'whatsapp', 'pending', NOW(), $2),
     ($1, 2, 'whatsapp', 'pending', NOW() + INTERVAL '3 days', $3),
     ($1, 3, 'whatsapp', 'pending', NOW() + INTERVAL '7 days', $4)`,
    [leadId, msg1, msg2, msg3]
  );

  // Update lead status
  await query(
    "UPDATE portal_leads SET status = 'nurturing', score = score + 10, updated_at = NOW() WHERE id = $1",
    [leadId]
  );
}

export async function updateLeadScore(leadId: string, delta: number): Promise<void> {
  await query(
    `UPDATE portal_leads SET score = score + $2, updated_at = NOW(),
     status = CASE
       WHEN score + $2 > 100 THEN 'convertido'
       WHEN score + $2 > 50 THEN 'qualificado'
       WHEN score + $2 < -10 THEN 'frio'
       ELSE status
     END
     WHERE id = $1 AND opted_out = false`,
    [leadId, delta]
  );
}

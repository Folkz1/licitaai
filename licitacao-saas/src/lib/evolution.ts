const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "https://apps-evolution-api.klx2s6.easypanel.host";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "CD6D2B1F7373-4086-AAC9-53391CF245E8";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "guyfolkz";

export async function sendWhatsApp(number: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_KEY,
      },
      body: JSON.stringify({
        number,
        text: message,
      }),
    });

    if (!res.ok) {
      console.error("[EVOLUTION] Send failed:", res.status, await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error("[EVOLUTION] Error:", err);
    return false;
  }
}

export async function notifyNewLead(lead: {
  nome: string;
  email: string;
  telefone?: string;
  empresa?: string;
  interesse?: string;
  source_slug?: string;
}) {
  const diegoNumber = "555193448124";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://licitaia.com.br";

  const lines = [
    `*Novo Lead no LicitaIA!*`,
    ``,
    `*Nome:* ${lead.nome}`,
    `*Email:* ${lead.email}`,
  ];

  if (lead.telefone) lines.push(`*WhatsApp:* ${lead.telefone}`);
  if (lead.empresa) lines.push(`*Empresa:* ${lead.empresa}`);
  if (lead.interesse) lines.push(`*Interesse:* ${lead.interesse}`);
  if (lead.source_slug) lines.push(`*Edital:* ${appUrl}/editais/${lead.source_slug}`);

  lines.push(``, `_${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}_`);

  return sendWhatsApp(diegoNumber, lines.join("\n"));
}

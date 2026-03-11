interface LeadNotificationInput {
  nome: string;
  email: string;
  telefone?: string;
  empresa?: string;
  interesse?: string;
  sourceSlug?: string;
  sourceUrl?: string;
}

interface TrialAccessEmailInput {
  nome: string;
  email: string;
  accessLink: string;
  expiresAt?: string | null;
  tempPassword?: string | null;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_TO_LEADS = process.env.EMAIL_TO_LEADS;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://licitai.mbest.site";

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && EMAIL_FROM && EMAIL_TO_LEADS);
}

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

export async function sendLeadNotificationEmail(
  input: LeadNotificationInput
): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false;
  }

  const html = [
    "<h2>Novo lead no LicitaIA</h2>",
    `<p><strong>Nome:</strong> ${escapeHtml(input.nome)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
    input.telefone
      ? `<p><strong>WhatsApp:</strong> ${escapeHtml(input.telefone)}</p>`
      : "",
    input.empresa
      ? `<p><strong>Empresa:</strong> ${escapeHtml(input.empresa)}</p>`
      : "",
    input.interesse
      ? `<p><strong>Interesse:</strong> ${escapeHtml(input.interesse)}</p>`
      : "",
    input.sourceUrl
      ? `<p><strong>Origem:</strong> <a href="${input.sourceUrl}">${input.sourceUrl}</a></p>`
      : "",
    input.sourceSlug
      ? `<p><strong>Slug:</strong> ${escapeHtml(input.sourceSlug)}</p>`
      : "",
    `<p><strong>Painel:</strong> <a href="${APP_URL}/admin/vendas">${APP_URL}/admin/vendas</a></p>`,
  ]
    .filter(Boolean)
    .join("");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_TO_LEADS],
        subject: `Novo lead LicitaIA: ${input.nome}`,
        html,
      }),
    });

    if (!res.ok) {
      console.error("[EMAIL] Lead notification failed:", res.status, await res.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[EMAIL] Lead notification error:", error);
    return false;
  }
}

export async function sendTrialAccessEmail(
  input: TrialAccessEmailInput
): Promise<boolean> {
  if (!isTransactionalEmailConfigured()) {
    return false;
  }

  const html = [
    `<h2>Seu acesso ao LicitaIA esta pronto</h2>`,
    `<p>Ola, <strong>${escapeHtml(input.nome)}</strong>.</p>`,
    `<p>Seu acesso assistido ao LicitaIA foi liberado.</p>`,
    `<p><a href="${input.accessLink}">Entrar agora no LicitaIA</a></p>`,
    input.tempPassword
      ? `<p><strong>Senha temporaria:</strong> ${escapeHtml(input.tempPassword)}</p>`
      : "",
    input.expiresAt
      ? `<p><strong>Validade do trial:</strong> ${new Date(input.expiresAt).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })}</p>`
      : "",
    `<p>Se precisar de ajuda para validar os primeiros editais, basta responder este email ou falar no WhatsApp.</p>`,
  ]
    .filter(Boolean)
    .join("");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [input.email],
        subject: "Seu acesso ao LicitaIA esta pronto",
        html,
      }),
    });

    if (!res.ok) {
      console.error("[EMAIL] Trial access failed:", res.status, await res.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[EMAIL] Trial access error:", error);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

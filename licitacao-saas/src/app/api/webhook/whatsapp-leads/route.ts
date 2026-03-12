import { query, queryOne } from "@/lib/db";
import { extractUfsFromText } from "@/lib/onboarding-config";
import { sendTrialAccessEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/evolution";
import {
  buildTrialAccessMessage,
  createTrialWorkspace,
  normalizePhone,
} from "@/lib/trial";
import { NextRequest, NextResponse } from "next/server";

const OPT_OUT_KEYWORDS = ["parar", "cancelar", "sair", "nao quero", "nao", "pare", "stop"];
const START_KEYWORDS = ["licitai", "licita ai", "trial licitai", "teste licitai", "diagnostico licitai", "quero licitai"];
const RESEND_KEYWORDS = ["link", "acesso", "senha", "entrar", "reenviar"];

type ConversationRow = {
  id: string;
  lead_id: string | null;
  current_stage: string;
  status: string;
  collected_data: Record<string, unknown>;
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function extractMessage(body: Record<string, unknown>) {
  const data = (body.data || {}) as Record<string, unknown>;
  const message = (data.message || {}) as Record<string, unknown>;
  const extended = (message.extendedTextMessage || {}) as Record<string, unknown>;
  const imageMessage = (message.imageMessage || {}) as Record<string, unknown>;

  return (
    (message.conversation as string) ||
    (extended.text as string) ||
    (imageMessage.caption as string) ||
    ""
  ).trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function shouldStartFlow(message: string) {
  return START_KEYWORDS.some((keyword) => message.includes(keyword));
}

function shouldResendAccess(message: string) {
  return RESEND_KEYWORDS.some((keyword) => message.includes(keyword));
}

async function loadConversation(phone: string) {
  return queryOne<ConversationRow>(
    `SELECT id, lead_id, current_stage, status, collected_data
     FROM whatsapp_conversations
     WHERE phone = $1
     LIMIT 1`,
    [phone]
  );
}

async function createConversation(phone: string, stage: string) {
  return queryOne<ConversationRow>(
    `INSERT INTO whatsapp_conversations (phone, current_stage, status, collected_data, last_inbound_at)
     VALUES ($1, $2, 'active', '{}'::jsonb, NOW())
     RETURNING id, lead_id, current_stage, status, collected_data`,
    [phone, stage]
  );
}

async function updateConversation(params: {
  conversationId: string;
  nextStage: string;
  collectedData: Record<string, unknown>;
  leadId?: string | null;
  status?: string;
}) {
  await query(
    `UPDATE whatsapp_conversations
     SET
       current_stage = $2,
       collected_data = $3::jsonb,
       lead_id = COALESCE($4, lead_id),
       status = COALESCE($5, status),
       last_inbound_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [
      params.conversationId,
      params.nextStage,
      JSON.stringify(params.collectedData),
      params.leadId || null,
      params.status || null,
    ]
  );
}

async function markConversationOutbound(conversationId: string) {
  await query(
    `UPDATE whatsapp_conversations
     SET last_outbound_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  ).catch(() => {});
}

async function reply(conversationId: string, phone: string, text: string) {
  await sendWhatsApp(phone, text);
  await markConversationOutbound(conversationId);
}

async function handleOptOut(phone: string) {
  await query(
    `UPDATE portal_leads
     SET opted_out = true, status = 'perdido', updated_at = NOW()
     WHERE telefone = $1 OR telefone LIKE $2`,
    [phone, `%${phone.slice(-11)}`]
  );

  await query(
    `UPDATE lead_sequences SET status = 'skipped'
     WHERE lead_id IN (
       SELECT id FROM portal_leads WHERE telefone = $1 OR telefone LIKE $2
     )
       AND status = 'pending'`,
    [phone, `%${phone.slice(-11)}`]
  );

  await query(
    `UPDATE whatsapp_conversations
     SET status = 'opted_out', updated_at = NOW()
     WHERE phone = $1`,
    [phone]
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data = (body.data || {}) as Record<string, unknown>;
    const key = (data.key || {}) as Record<string, unknown>;
    const remoteJid = String(key.remoteJid || "");
    const fromMe = Boolean(key.fromMe);
    const message = extractMessage(body);

    if (!message || !remoteJid || fromMe || remoteJid.endsWith("@g.us")) {
      return NextResponse.json({ ok: true });
    }

    const phone = normalizePhone(remoteJid.replace("@s.whatsapp.net", ""));
    if (!phone) {
      return NextResponse.json({ ok: true });
    }

    const lowerMessage = normalizeText(message);
    const isOptOut = OPT_OUT_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));

    let conversation = await loadConversation(phone);

    // Only handle opt-out for contacts that already have a LicitaAI conversation
    if (isOptOut && conversation) {
      await handleOptOut(phone);
      await sendWhatsApp(phone, "Tudo certo. Vou parar as mensagens do LicitaAI por aqui.");
      return NextResponse.json({ ok: true, optOut: true });
    }

    if (!conversation) {
      if (!shouldStartFlow(lowerMessage)) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      conversation = await createConversation(phone, "ask_name");
      if (conversation) {
        await reply(
          conversation.id,
          phone,
          "Recebi seu interesse no LicitaAI.\n\nVou criar um trial assistido de 7 dias com ate 5 analises por dia.\n\nPrimeiro: qual seu nome?"
        );
      }
      return NextResponse.json({ ok: true, started: true });
    }

    const collectedData = {
      ...(conversation.collected_data || {}),
    } as Record<string, unknown>;

    if (conversation.current_stage === "completed") {
      if (shouldResendAccess(lowerMessage) && collectedData.email && collectedData.nome) {
        const provision = await createTrialWorkspace({
          nome: String(collectedData.nome),
          email: String(collectedData.email),
          telefone: phone,
          empresa: String(collectedData.empresa || ""),
          segmento: String(collectedData.segmento || ""),
          interesse: String(collectedData.interesse || ""),
          ufs: Array.isArray(collectedData.ufs) ? (collectedData.ufs as string[]) : [],
          qualificationChannel: "whatsapp",
          qualificationData: collectedData,
          sourceUrl: "whatsapp://bot",
        });

        await updateConversation({
          conversationId: conversation.id,
          nextStage: "completed",
          leadId: provision.leadId,
          status: "active",
          collectedData: {
            ...collectedData,
            tenant_id: provision.tenantId,
            user_id: provision.userId,
          },
        });

        await reply(
          conversation.id,
          phone,
          buildTrialAccessMessage({
            nome: provision.createdWorkspace ? String(collectedData.nome) : String(collectedData.nome),
            accessLink: provision.accessLink,
            email: provision.email,
            tempPassword: provision.tempPassword,
            expiresAt: provision.expiresAt,
            trialStatus: provision.trialStatus,
          })
        );

        if (provision.email) {
          sendTrialAccessEmail({
            nome: String(collectedData.nome),
            email: provision.email,
            accessLink: provision.accessLink,
            expiresAt: provision.expiresAt,
            tempPassword: provision.tempPassword,
          }).catch(() => {});
        }
      } else {
        await reply(
          conversation.id,
          phone,
          "Seu acesso ao LicitaAI ja esta pronto. Se quiser reenviar o link, responda com: link"
        );
      }

      return NextResponse.json({ ok: true, resumed: true });
    }

    if (conversation.current_stage === "ask_name") {
      if (message.trim().length < 2) {
        await reply(conversation.id, phone, "Preciso do seu nome para continuar. Pode me mandar seu nome completo?");
        return NextResponse.json({ ok: true, retry: "name" });
      }

      collectedData.nome = message.trim();
      await updateConversation({
        conversationId: conversation.id,
        nextStage: "ask_email",
        collectedData,
      });

      await reply(conversation.id, phone, "Perfeito. Qual o melhor email para eu criar seu acesso?");
      return NextResponse.json({ ok: true, stage: "ask_email" });
    }

    if (conversation.current_stage === "ask_email") {
      if (!isValidEmail(message.trim())) {
        await reply(conversation.id, phone, "Esse email parece invalido. Me manda um email no formato nome@empresa.com.br.");
        return NextResponse.json({ ok: true, retry: "email" });
      }

      collectedData.email = message.trim().toLowerCase();
      await updateConversation({
        conversationId: conversation.id,
        nextStage: "ask_company",
        collectedData,
      });

      await reply(conversation.id, phone, "Qual o nome da sua empresa ou consultoria?");
      return NextResponse.json({ ok: true, stage: "ask_company" });
    }

    if (conversation.current_stage === "ask_company") {
      collectedData.empresa = message.trim();
      await updateConversation({
        conversationId: conversation.id,
        nextStage: "ask_segment",
        collectedData,
      });

      await reply(
        conversation.id,
        phone,
        "Agora me diga seu segmento principal e o que voce quer encontrar em licitacoes.\n\nExemplo: software para saude, papelaria corporativa, consultoria em pregoes."
      );
      return NextResponse.json({ ok: true, stage: "ask_segment" });
    }

    if (conversation.current_stage === "ask_segment") {
      collectedData.segmento = message.trim();
      await updateConversation({
        conversationId: conversation.id,
        nextStage: "ask_uf",
        collectedData,
      });

      await reply(
        conversation.id,
        phone,
        "Quais UFs voce quer priorizar?\n\nPode responder assim: SP, RJ, MG.\nSe atuar no Brasil todo, responda: Brasil."
      );
      return NextResponse.json({ ok: true, stage: "ask_uf" });
    }

    if (conversation.current_stage === "ask_uf") {
      const ufs = extractUfsFromText(message);
      const normalized = normalizeText(message);

      if (ufs.length === 0 && !normalized.includes("brasil") && !normalized.includes("todo")) {
        await reply(
          conversation.id,
          phone,
          "Nao consegui identificar os estados. Me responde com as siglas, por exemplo: SP, RJ, MG. Se for Brasil todo, responda Brasil."
        );
        return NextResponse.json({ ok: true, retry: "ufs" });
      }

      collectedData.ufs = ufs;
      await updateConversation({
        conversationId: conversation.id,
        nextStage: "ask_goal",
        collectedData,
      });

      await reply(
        conversation.id,
        phone,
        "Ultima pergunta: qual seu objetivo com o LicitaAI agora?\n\nExemplo: encontrar editais no meu segmento, qualificar oportunidades, reduzir tempo de triagem."
      );
      return NextResponse.json({ ok: true, stage: "ask_goal" });
    }

    if (conversation.current_stage === "ask_goal") {
      collectedData.interesse = message.trim();
      await updateConversation({
        conversationId: conversation.id,
        nextStage: "provisioning",
        collectedData,
      });

      await reply(
        conversation.id,
        phone,
        "Perfeito. Estou criando seu acesso assistido agora. Isso pode levar alguns segundos..."
      );

      try {
        const provision = await createTrialWorkspace({
          nome: String(collectedData.nome || ""),
          email: String(collectedData.email || ""),
          telefone: phone,
          empresa: String(collectedData.empresa || ""),
          segmento: String(collectedData.segmento || ""),
          interesse: String(collectedData.interesse || ""),
          ufs: Array.isArray(collectedData.ufs) ? (collectedData.ufs as string[]) : [],
          qualificationChannel: "whatsapp",
          qualificationData: collectedData,
          sourceUrl: "whatsapp://bot",
        });

        await updateConversation({
          conversationId: conversation.id,
          nextStage: "completed",
          leadId: provision.leadId,
          status: "active",
          collectedData: {
            ...collectedData,
            tenant_id: provision.tenantId,
            user_id: provision.userId,
            trial_expires_at: provision.expiresAt,
          },
        });

        await reply(
          conversation.id,
          phone,
          buildTrialAccessMessage({
            nome: String(collectedData.nome || ""),
            accessLink: provision.accessLink,
            email: provision.email,
            tempPassword: provision.tempPassword,
            expiresAt: provision.expiresAt,
            trialStatus: provision.trialStatus,
          })
        );

        if (provision.email) {
          sendTrialAccessEmail({
            nome: String(collectedData.nome || ""),
            email: provision.email,
            accessLink: provision.accessLink,
            expiresAt: provision.expiresAt,
            tempPassword: provision.tempPassword,
          }).catch(() => {});
        }

        return NextResponse.json({ ok: true, provisioned: true, tenantId: provision.tenantId });
      } catch (error) {
        console.error("[WHATSAPP_BOT] Trial provisioning error:", error);
        await updateConversation({
          conversationId: conversation.id,
          nextStage: "ask_goal",
          collectedData,
          status: "active",
        });
        await reply(
          conversation.id,
          phone,
          "Tive um erro ao criar seu acesso. Me manda novamente seu objetivo com o LicitaAI ou responde aqui com a palavra link que eu tento de novo."
        );
        return NextResponse.json({ ok: true, provisioned: false });
      }
    }

    return NextResponse.json({ ok: true, stage: conversation.current_stage });
  } catch (error) {
    console.error("[WHATSAPP_BOT] Error:", error);
    return NextResponse.json({ ok: true });
  }
}

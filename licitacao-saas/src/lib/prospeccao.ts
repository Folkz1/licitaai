import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { pool, query, queryOne } from "@/lib/db";
import { createAutoLoginToken, normalizePhone } from "@/lib/trial";
import { sendWhatsApp, notifyNewLead } from "@/lib/evolution";
import type { PoolClient } from "pg";

const TRIAL_PLAN_NAME = process.env.TRIAL_PLAN_NAME || "trial_7d";
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function firstName(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

function getTrialExpiryDate(baseDate = new Date()) {
  return new Date(baseDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

async function queryOneTx<T = Record<string, unknown>>(
  client: PoolClient,
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await client.query(text, params);
  return (result.rows[0] as T) || null;
}

async function ensureTrialPlanWithClient(client: PoolClient) {
  const existing = await queryOneTx<{ id: string }>(
    client,
    "SELECT id FROM plans WHERE name = $1 LIMIT 1",
    [TRIAL_PLAN_NAME]
  );

  if (existing) return existing;

  return queryOneTx<{ id: string }>(
    client,
    `INSERT INTO plans (
      name, display_name, max_licitacoes_per_month, max_users,
      max_searches_per_day, features, price_monthly_cents, is_active, max_tokens_per_month
    ) VALUES ($1, 'Trial 7 Dias', 50, 1, 5, $2::jsonb, 0, false, 200000)
    RETURNING id`,
    [
      TRIAL_PLAN_NAME,
      JSON.stringify({
        trial_days: TRIAL_DAYS,
        daily_analysis_limit: 5,
        enforce_trial: true,
        show_trial_banner: true,
        allow_batch_analysis: true,
        channel: "prospeccao",
      }),
    ]
  );
}

function buildProspeccaoMessages(params: {
  nome: string;
  empresa: string;
  segmento: string;
  uf: string;
  accessLink: string;
}) {
  const nome = firstName(params.nome);
  const empresa = params.empresa;
  const segmento = params.segmento;
  const uf = params.uf;
  const accessLink = params.accessLink;

  const step0 = [
    `Oi ${nome}! Aqui é o Diego da LicitaIA.`,
    "",
    `Preparei um acesso exclusivo de 7 dias para a ${empresa} testar nossa plataforma de monitoramento de licitações.`,
    "",
    `A IA já está configurada para o segmento de ${segmento} em ${uf}. É só clicar no link abaixo e explorar:`,
    "",
    accessLink,
    "",
    "Qualquer dúvida, me chama aqui mesmo!",
  ].join("\n");

  const step1 = [
    `Oi ${nome}! Passando pra saber como está a experiência com o LicitaIA.`,
    "",
    `Faltam 2 dias do seu acesso. Já encontrou licitações interessantes para a ${empresa}?`,
    "",
    "Se quiser, posso te mostrar como configurar alertas automáticos pro seu segmento.",
  ].join("\n");

  const step2 = [
    `${nome}, seu acesso de teste encerra hoje.`,
    "",
    `Se o LicitaIA fez sentido pra ${empresa}, vamos conversar sobre um plano que caiba na operação de vocês.`,
    "",
    "Posso te ligar hoje ou amanhã?",
  ].join("\n");

  return { step0, step1, step2 };
}

export interface LeadInput {
  nome: string;
  empresa: string;
  segmento: string;
  uf: string;
  telefone: string;
  email: string;
}

export interface TrialPresenteResult {
  success: boolean;
  leadId: string;
  tenantId: string;
  userId: string;
  accessLink: string;
  whatsappSent: boolean;
  error?: string;
}

/**
 * Creates a full trial "presente" for a prospect:
 * tenant + user + subscription + lead + auto-login + nurturing + WhatsApp send.
 *
 * Shared between the manual criar-trial route and the batch/cron prospect-send.
 */
export async function createTrialPresente(
  lead: LeadInput,
  options?: { createdBy?: string; skipWhatsApp?: boolean }
): Promise<TrialPresenteResult> {
  const nome = cleanString(lead.nome);
  const empresa = cleanString(lead.empresa);
  const segmento = cleanString(lead.segmento);
  const uf = cleanString(lead.uf).toUpperCase();
  const telefone = cleanString(lead.telefone);
  const email = cleanString(lead.email).toLowerCase();

  const normalizedPhone = normalizePhone(telefone);
  if (!normalizedPhone) {
    return {
      success: false,
      leadId: "",
      tenantId: "",
      userId: "",
      accessLink: "",
      whatsappSent: false,
      error: "Telefone inválido",
    };
  }

  const client = await pool.connect();
  let tenantId = "";
  let userId = "";
  let leadId = "";
  const tempPassword = randomBytes(5).toString("base64url");
  const trialExpiresAt = getTrialExpiryDate();

  try {
    await client.query("BEGIN");

    // 1. Check duplicate by email
    const existingUser = await queryOneTx<{ id: string; tenant_id: string }>(
      client,
      "SELECT id, tenant_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    if (existingUser) {
      await client.query("ROLLBACK");
      return {
        success: false,
        leadId: "",
        tenantId: existingUser.tenant_id,
        userId: existingUser.id,
        accessLink: "",
        whatsappSent: false,
        error: `Já existe conta com email ${email}`,
      };
    }

    // 2. Create tenant
    const baseSlug = slugify(empresa) || `trial-${Date.now().toString(36)}`;
    const existingSlug = await queryOneTx<{ id: string }>(
      client,
      "SELECT id FROM tenants WHERE slug = $1 LIMIT 1",
      [baseSlug]
    );
    const slug = existingSlug
      ? `${baseSlug}-${randomBytes(2).toString("hex")}`
      : baseSlug;

    const tenant = await queryOneTx<{ id: string }>(
      client,
      `INSERT INTO tenants (nome, slug, segmento, plano, config)
       VALUES ($1, $2, $3, $4, '{}'::jsonb)
       RETURNING id`,
      [empresa, slug, segmento, TRIAL_PLAN_NAME]
    );
    tenantId = tenant?.id || "";

    // 3. Create user
    const passwordHash = await hash(tempPassword, 12);
    const user = await queryOneTx<{ id: string }>(
      client,
      `INSERT INTO users (tenant_id, email, nome, password_hash, role, ativo)
       VALUES ($1, $2, $3, $4, 'ANALYST', true)
       RETURNING id`,
      [tenantId, email, nome, passwordHash]
    );
    userId = user?.id || "";

    // 4. Create subscription
    const trialPlan = await ensureTrialPlanWithClient(client);
    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, expires_at, notes)
       VALUES ($1, $2, 'TRIAL', NOW(), $3, 'Trial criado via prospecção batch')`,
      [tenantId, trialPlan?.id, trialExpiresAt.toISOString()]
    );

    // 5. Create portal_lead
    const leadRow = await queryOneTx<{ id: string }>(
      client,
      `INSERT INTO portal_leads (
        nome, email, telefone, empresa, interesse, status, score,
        tenant_id, user_id, trial_started_at, trial_expires_at, trial_status,
        qualification_channel, qualification_data, utm_source, utm_medium,
        source, prospect_status, source_url
      ) VALUES (
        $1, $2, $3, $4, $5, 'trial_ativo', 80,
        $6, $7, NOW(), $8, 'active',
        'prospeccao', $9::jsonb, 'prospeccao', 'admin',
        'prospeccao', 'enviado', 'admin://prospeccao'
      )
      RETURNING id`,
      [
        nome,
        email,
        normalizedPhone,
        empresa,
        `${segmento} | ${uf}`,
        tenantId,
        userId,
        trialExpiresAt.toISOString(),
        JSON.stringify({
          segmento,
          uf,
          created_by: options?.createdBy || "batch",
          created_at: new Date().toISOString(),
        }),
      ]
    );
    leadId = leadRow?.id || "";

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // 6. Generate auto-login token (192h = 8 days)
  const autoLoginExpiry = new Date(Date.now() + 192 * 60 * 60 * 1000);
  const accessToken = await createAutoLoginToken({
    tenantId,
    userId,
    expiresAt: autoLoginExpiry,
    metadata: {
      source: "prospeccao_batch",
      lead_id: leadId,
    },
  });

  // Mark lead as contacted
  await query(
    "UPDATE portal_leads SET access_token_last_sent_at = NOW(), last_contacted_at = NOW(), updated_at = NOW() WHERE id = $1",
    [leadId]
  );

  // 7. Create 3-step nurturing sequence
  const messages = buildProspeccaoMessages({
    nome,
    empresa,
    segmento,
    uf,
    accessLink: accessToken.accessLink,
  });

  await query(
    `INSERT INTO lead_sequences (lead_id, step, channel, status, scheduled_at, message_text) VALUES
     ($1, 1, 'whatsapp', 'pending', NOW(), $2),
     ($1, 2, 'whatsapp', 'pending', NOW() + INTERVAL '5 days', $3),
     ($1, 3, 'whatsapp', 'pending', NOW() + INTERVAL '7 days', $4)`,
    [leadId, messages.step0, messages.step1, messages.step2]
  );

  // 8. Send WhatsApp (unless skipped)
  let whatsappSent = false;
  if (!options?.skipWhatsApp) {
    try {
      whatsappSent = await sendWhatsApp(normalizedPhone, messages.step0);

      if (whatsappSent) {
        await query(
          "UPDATE lead_sequences SET status = 'sent', sent_at = NOW() WHERE lead_id = $1 AND step = 1",
          [leadId]
        );
      }
    } catch (err) {
      console.error("[PROSPECCAO] Erro ao enviar WhatsApp:", err);
    }
  }

  // 9. Notify Diego
  try {
    await notifyNewLead({
      nome,
      email,
      telefone: normalizedPhone,
      empresa,
      interesse: `Prospecção: ${segmento} em ${uf}`,
    });
  } catch (err) {
    console.error("[PROSPECCAO] Erro ao notificar Diego:", err);
  }

  return {
    success: true,
    leadId,
    tenantId,
    userId,
    accessLink: accessToken.accessLink,
    whatsappSent,
  };
}

/**
 * Check if a lead already exists by email or phone.
 * Returns the duplicate source if found.
 */
export async function checkDuplicate(
  email: string,
  telefone: string
): Promise<{ isDuplicate: boolean; reason?: string }> {
  const normalizedPhone = normalizePhone(telefone);

  // Check portal_leads
  const existingLead = await queryOne<{ id: string; email: string; telefone: string | null }>(
    `SELECT id, email, telefone FROM portal_leads
     WHERE LOWER(email) = LOWER($1)
        OR ($2::text IS NOT NULL AND telefone = $2::text)
     LIMIT 1`,
    [email.trim().toLowerCase(), normalizedPhone]
  );

  if (existingLead) {
    return { isDuplicate: true, reason: `Lead já existe (portal_leads)` };
  }

  // Check users table
  const existingUser = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email.trim().toLowerCase()]
  );

  if (existingUser) {
    return { isDuplicate: true, reason: `Usuário já existe (users)` };
  }

  return { isDuplicate: false };
}

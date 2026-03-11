import { pool, query, queryOne } from "@/lib/db";
import { completeOnboardingSetup } from "@/lib/onboarding-completion";
import {
  buildOnboardingContext,
  extractKeywordsFromText,
  generateTemplateConfig,
  mapSegmentToRamoPrincipal,
} from "@/lib/onboarding-config";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import type { PoolClient } from "pg";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://licitai.mbest.site";
const TRIAL_PLAN_NAME = process.env.TRIAL_PLAN_NAME || "trial_7d";
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);
const TRIAL_DAILY_ANALYSIS_LIMIT = Number(process.env.TRIAL_DAILY_ANALYSIS_LIMIT || 5);
const AUTOLOGIN_TTL_HOURS = Number(process.env.AUTOLOGIN_TTL_HOURS || 24 * 8);

interface SubscriptionRow {
  id: string;
  status: string;
  expires_at: string | null;
  started_at: string | null;
  plan_name: string | null;
  plan_display_name: string | null;
  max_users: number | null;
  max_searches_per_day: number | null;
  max_licitacoes_per_month: number | null;
  features: Record<string, unknown> | null;
}

interface ExistingUserRow {
  id: string;
  tenant_id: string;
  email: string;
  nome: string;
  role: string;
  tenant_nome: string;
  onboarding_completed: boolean;
}

export interface TrialStatus {
  enforced: boolean;
  isTrial: boolean;
  expired: boolean;
  subscriptionStatus: string | null;
  planName: string | null;
  planDisplayName: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  dailyAnalysisLimit: number | null;
  analysesUsedToday: number;
  analysesRemainingToday: number | null;
  maxUsers: number | null;
}

export interface TrialProvisionInput {
  nome: string;
  email: string;
  telefone?: string | null;
  empresa?: string | null;
  segmento?: string | null;
  interesse?: string | null;
  ufs?: string[];
  qualificationChannel?: string;
  qualificationData?: Record<string, unknown>;
  sourceUrl?: string | null;
}

export interface TrialProvisionResult {
  leadId: string | null;
  tenantId: string;
  userId: string;
  email: string;
  tempPassword: string | null;
  accessLink: string;
  expiresAt: string | null;
  dashboardPath: string;
  trialStatus: TrialStatus;
  createdWorkspace: boolean;
  tenantName: string;
}

export class TrialQuotaError extends Error {
  code: "TRIAL_EXPIRED" | "TRIAL_DAILY_LIMIT";
  statusCode: number;

  constructor(code: "TRIAL_EXPIRED" | "TRIAL_DAILY_LIMIT", message: string) {
    super(message);
    this.name = "TrialQuotaError";
    this.code = code;
    this.statusCode = code === "TRIAL_EXPIRED" ? 403 : 429;
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getTrialExpiryDate(baseDate = new Date()) {
  return new Date(baseDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

function getAutoLoginExpiryDate(baseDate = new Date()) {
  return new Date(baseDate.getTime() + AUTOLOGIN_TTL_HOURS * 60 * 60 * 1000);
}

function firstName(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 10) return `55${digits}`;
  return digits;
}

async function queryOneTx<T = Record<string, unknown>>(
  client: PoolClient,
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await client.query(text, params);
  return (result.rows[0] as T) || null;
}

async function queryTx(client: PoolClient, text: string, params?: unknown[]) {
  await client.query(text, params);
}

async function ensureTrialPlanWithClient(client: PoolClient) {
  const existing = await queryOneTx<{ id: string }>(
    client,
    "SELECT id FROM plans WHERE name = $1 LIMIT 1",
    [TRIAL_PLAN_NAME]
  );

  if (existing) {
    return existing;
  }

  return queryOneTx<{ id: string }>(
    client,
    `INSERT INTO plans (
      name,
      display_name,
      max_licitacoes_per_month,
      max_users,
      max_searches_per_day,
      features,
      price_monthly_cents,
      is_active,
      max_tokens_per_month
    ) VALUES ($1, 'Trial 7 Dias', 50, 1, $2, $3::jsonb, 0, false, 200000)
    RETURNING id`,
    [
      TRIAL_PLAN_NAME,
      TRIAL_DAILY_ANALYSIS_LIMIT,
      JSON.stringify({
        trial_days: TRIAL_DAYS,
        daily_analysis_limit: TRIAL_DAILY_ANALYSIS_LIMIT,
        enforce_trial: true,
        show_trial_banner: true,
        allow_batch_analysis: true,
        channel: "whatsapp",
      }),
    ]
  );
}

function buildTrialOnboardingDraft(input: TrialProvisionInput, tenantName: string) {
  const segmentoTexto = [input.segmento, input.interesse].filter(Boolean).join(" ");
  const ramoPrincipal = mapSegmentToRamoPrincipal(segmentoTexto);
  const keywordSeed = extractKeywordsFromText(segmentoTexto, 6);

  const step1 = {
    razao_social: input.empresa || tenantName,
    nome_fantasia: input.empresa || tenantName,
    porte: "ME",
    setor: input.segmento || "Operacao comercial",
    descricao_livre:
      input.interesse ||
      input.segmento ||
      "Lead captado e qualificado automaticamente via WhatsApp.",
  };

  const step2 = {
    ramo_principal: ramoPrincipal,
    ramo_secundario: [],
    experiencia_pregao: true,
    tipos_clientes: ["Publico"],
  };

  const step3 = {
    produtos_servicos:
      input.segmento ||
      input.interesse ||
      "Operacao comercial qualificada via WhatsApp",
    palavras_chave_manual: keywordSeed,
    exclusoes: "",
  };

  const step4 = {
    ufs_interesse: input.ufs || [],
    municipios_interesse: [],
    modalidades: [1, 6],
    valor_minimo: 0,
    valor_maximo: null,
    dias_retroativos: 15,
  };

  const aiGeneratedConfig = generateTemplateConfig(
    buildOnboardingContext({ step1, step2, step3, step4 })
  );

  return { step1, step2, step3, step4, aiGeneratedConfig };
}

async function upsertPortalLeadWithClient(
  client: PoolClient,
  input: TrialProvisionInput,
  payload: {
    tenantId: string;
    userId: string;
    trialStartedAt: Date | null;
    trialExpiresAt: Date | null;
    trialStatus: string | null;
  }
) {
  const normalizedPhone = normalizePhone(input.telefone) || input.telefone || null;
  const existingLead = await queryOneTx<{ id: string }>(
    client,
    `SELECT id
     FROM portal_leads
     WHERE LOWER(email) = LOWER($1)
        OR ($2::text IS NOT NULL AND telefone = $2::text)
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.email, normalizedPhone]
  );

  const interesse = [input.segmento, input.interesse].filter(Boolean).join(" | ") || null;
  const qualificationData = JSON.stringify(input.qualificationData || {});

  if (existingLead) {
    await queryTx(
      client,
      `UPDATE portal_leads
       SET
         nome = $2,
         email = $3,
         telefone = $4,
         empresa = $5,
         interesse = $6,
         status = $7,
         tenant_id = $8,
         user_id = $9,
         trial_started_at = $10,
       trial_expires_at = $11,
        trial_status = $12,
       qualification_channel = $13,
        qualification_data = $14::jsonb,
        score = GREATEST(COALESCE(score, 0), CASE WHEN $12::text IS NOT NULL THEN 80 ELSE 60 END),
        last_contacted_at = NOW(),
        updated_at = NOW()
       WHERE id = $1`,
      [
        existingLead.id,
        input.nome,
        input.email,
        normalizedPhone,
        input.empresa || null,
        interesse,
        payload.trialStatus ? "trial_ativo" : "qualificado",
        payload.tenantId,
        payload.userId,
        payload.trialStartedAt?.toISOString() || null,
        payload.trialExpiresAt?.toISOString() || null,
        payload.trialStatus,
        input.qualificationChannel || "whatsapp",
        qualificationData,
      ]
    );

    return existingLead.id;
  }

  const lead = await queryOneTx<{ id: string }>(
    client,
    `INSERT INTO portal_leads (
      nome,
      email,
      telefone,
      empresa,
      interesse,
      status,
      score,
      tenant_id,
      user_id,
      trial_started_at,
      trial_expires_at,
      trial_status,
      qualification_channel,
      qualification_data,
      utm_source,
      utm_medium,
      source_url
    ) VALUES (
      $1, $2, $3, $4, $5, $6, CASE WHEN $11::text IS NOT NULL THEN 80 ELSE 60 END, $7, $8, $9, $10, $11, $12, $13::jsonb, 'whatsapp', 'bot', $14
    )
    RETURNING id`,
    [
      input.nome,
      input.email,
      normalizedPhone,
      input.empresa || null,
      interesse,
      payload.trialStatus ? "trial_ativo" : "qualificado",
      payload.tenantId,
      payload.userId,
      payload.trialStartedAt?.toISOString() || null,
      payload.trialExpiresAt?.toISOString() || null,
      payload.trialStatus,
      input.qualificationChannel || "whatsapp",
      qualificationData,
      input.sourceUrl || "whatsapp://bot",
    ]
  );

  return lead?.id || null;
}

async function getSubscriptionRow(tenantId: string): Promise<SubscriptionRow | null> {
  return queryOne<SubscriptionRow>(
    `SELECT
      s.id,
      s.status,
      s.expires_at,
      s.started_at,
      p.name as plan_name,
      p.display_name as plan_display_name,
      p.max_users,
      p.max_searches_per_day,
      p.max_licitacoes_per_month,
      p.features
     FROM subscriptions s
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE s.tenant_id = $1
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [tenantId]
  );
}

function buildTrialStatus(subscription: SubscriptionRow | null, analysesUsedToday: number): TrialStatus {
  const features =
    subscription?.features && typeof subscription.features === "object"
      ? subscription.features
      : {};

  const isTrial =
    subscription?.status === "TRIAL" ||
    subscription?.plan_name === TRIAL_PLAN_NAME ||
    Boolean(features.enforce_trial);

  const expiresAt = subscription?.expires_at || null;
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
  const expired = Boolean(isTrial && expiresAtDate && expiresAtDate.getTime() < Date.now());
  const daysRemaining =
    expiresAtDate && isTrial
      ? Math.max(0, Math.ceil((expiresAtDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  const dailyLimit = isTrial
    ? Number(
        features.daily_analysis_limit ||
          subscription?.max_searches_per_day ||
          TRIAL_DAILY_ANALYSIS_LIMIT
      )
    : null;

  return {
    enforced: isTrial,
    isTrial,
    expired,
    subscriptionStatus: subscription?.status || null,
    planName: subscription?.plan_name || null,
    planDisplayName: subscription?.plan_display_name || null,
    expiresAt,
    daysRemaining,
    dailyAnalysisLimit: dailyLimit,
    analysesUsedToday,
    analysesRemainingToday:
      dailyLimit === null ? null : Math.max(0, dailyLimit - analysesUsedToday),
    maxUsers: subscription?.max_users || null,
  };
}

export async function getTenantTrialStatus(tenantId: string): Promise<TrialStatus> {
  const [subscription, usage] = await Promise.all([
    getSubscriptionRow(tenantId),
    queryOne<{ used_count: number }>(
      `SELECT used_count
       FROM tenant_daily_usage
       WHERE tenant_id = $1 AND usage_date = CURRENT_DATE AND metric = 'analysis'`,
      [tenantId]
    ),
  ]);

  return buildTrialStatus(subscription, Number(usage?.used_count || 0));
}

export async function assertTenantOperationalAccess(
  tenantId: string,
  operation: "search" | "analysis"
): Promise<TrialStatus> {
  const status = await getTenantTrialStatus(tenantId);

  if (status.enforced && status.expired) {
    throw new TrialQuotaError(
      "TRIAL_EXPIRED",
      `Seu trial gratuito expirou. Responda no WhatsApp para continuar usando a ${operation === "analysis" ? "analise" : "busca"}.`
    );
  }

  return status;
}

export async function consumeDailyAnalysisQuota(
  tenantId: string,
  amount = 1
): Promise<TrialStatus> {
  const status = await getTenantTrialStatus(tenantId);

  if (!status.enforced) {
    return status;
  }

  if (status.expired) {
    throw new TrialQuotaError(
      "TRIAL_EXPIRED",
      "Seu trial gratuito expirou. Responda no WhatsApp para continuar com o LicitaIA."
    );
  }

  const dailyLimit = status.dailyAnalysisLimit || TRIAL_DAILY_ANALYSIS_LIMIT;

  await query(
    `INSERT INTO tenant_daily_usage (tenant_id, usage_date, metric, used_count)
     VALUES ($1, CURRENT_DATE, 'analysis', 0)
     ON CONFLICT (tenant_id, usage_date, metric) DO NOTHING`,
    [tenantId]
  );

  const updated = await queryOne<{ used_count: number }>(
    `UPDATE tenant_daily_usage
     SET used_count = used_count + $2, updated_at = NOW()
     WHERE tenant_id = $1
       AND usage_date = CURRENT_DATE
       AND metric = 'analysis'
       AND used_count + $2 <= $3
     RETURNING used_count`,
    [tenantId, amount, dailyLimit]
  );

  if (!updated) {
    throw new TrialQuotaError(
      "TRIAL_DAILY_LIMIT",
      `Voce atingiu o limite de ${dailyLimit} analises por dia no trial.`
    );
  }

  return getTenantTrialStatus(tenantId);
}

export async function createAutoLoginToken(params: {
  tenantId: string;
  userId: string;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = params.expiresAt || getAutoLoginExpiryDate();

  await query(
    `INSERT INTO access_tokens (user_id, tenant_id, token_hash, kind, expires_at, metadata)
     VALUES ($1, $2, $3, 'AUTOLOGIN', $4, $5::jsonb)`,
    [
      params.userId,
      params.tenantId,
      tokenHash,
      expiresAt.toISOString(),
      JSON.stringify(params.metadata || {}),
    ]
  );

  return {
    rawToken,
    expiresAt,
    accessLink: `${APP_URL}/acesso/${rawToken}`,
  };
}

export async function markTrialAccessSent(leadId: string | null) {
  if (!leadId) return;

  await query(
    `UPDATE portal_leads
     SET access_token_last_sent_at = NOW(), last_contacted_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [leadId]
  );
}

export function buildTrialAccessMessage(params: {
  nome: string;
  accessLink: string;
  email: string;
  tempPassword?: string | null;
  expiresAt?: string | null;
  trialStatus: TrialStatus;
}) {
  const lines = [
    `Perfeito, ${firstName(params.nome)}. Seu acesso do LicitaAI esta pronto.`,
    "",
    `Trial assistido: ${TRIAL_DAYS} dias com ate ${params.trialStatus.dailyAnalysisLimit || TRIAL_DAILY_ANALYSIS_LIMIT} analises por dia.`,
    `Entrar agora: ${params.accessLink}`,
    `Email: ${params.email}`,
  ];

  if (params.tempPassword) {
    lines.push(`Senha temporaria: ${params.tempPassword}`);
  }

  if (params.expiresAt) {
    lines.push(
      `Validade do trial: ${new Date(params.expiresAt).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}`
    );
  }

  lines.push("", "Se quiser, eu continuo aqui e te ajudo a validar os primeiros editais.");

  return lines.join("\n");
}

export async function createTrialWorkspace(
  input: TrialProvisionInput
): Promise<TrialProvisionResult> {
  const client = await pool.connect();
  let tenantId = "";
  let userId = "";
  let tenantName = "";
  const email = input.email.trim().toLowerCase();
  let tempPassword: string | null = null;
  let leadId: string | null = null;
  let dashboardPath = "/dashboard";
  let createdWorkspace = false;
  let trialExpiresAt: Date | null = null;

  try {
    await client.query("BEGIN");

    const existingUser = await queryOneTx<ExistingUserRow>(
      client,
      `SELECT
         u.id,
         u.tenant_id,
         u.email,
         u.nome,
         u.role,
         t.nome as tenant_nome,
         t.onboarding_completed
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (existingUser) {
      userId = existingUser.id;
      tenantId = existingUser.tenant_id;
      tenantName = existingUser.tenant_nome;
      dashboardPath = existingUser.onboarding_completed ? "/dashboard" : "/onboarding";

      const existingSubscription = await queryOneTx<SubscriptionRow>(
        client,
        `SELECT
           s.id,
           s.status,
           s.expires_at,
           s.started_at,
           p.name as plan_name,
           p.display_name as plan_display_name,
           p.max_users,
           p.max_searches_per_day,
           p.max_licitacoes_per_month,
           p.features
         FROM subscriptions s
         LEFT JOIN plans p ON p.id = s.plan_id
         WHERE s.tenant_id = $1
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [tenantId]
      );

      if (!existingSubscription) {
        const trialPlan = await ensureTrialPlanWithClient(client);
        trialExpiresAt = getTrialExpiryDate();
        await queryTx(
          client,
          `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, expires_at, notes)
           VALUES ($1, $2, 'TRIAL', NOW(), $3, 'Trial criado automaticamente via WhatsApp')`,
          [tenantId, trialPlan?.id, trialExpiresAt.toISOString()]
        );
      } else if (existingSubscription.status === "TRIAL") {
        trialExpiresAt = existingSubscription.expires_at
          ? new Date(existingSubscription.expires_at)
          : getTrialExpiryDate();
      } else if (existingSubscription.status !== "ACTIVE") {
        const trialPlan = await ensureTrialPlanWithClient(client);
        trialExpiresAt = getTrialExpiryDate();
        await queryTx(
          client,
          `UPDATE subscriptions
           SET plan_id = $2, status = 'TRIAL', started_at = NOW(), expires_at = $3, updated_at = NOW(),
               notes = COALESCE(notes, '') || E'\nTrial reativado automaticamente via WhatsApp.'
           WHERE tenant_id = $1`,
          [tenantId, trialPlan?.id, trialExpiresAt.toISOString()]
        );
      }
    } else {
      createdWorkspace = true;
      const trialPlan = await ensureTrialPlanWithClient(client);
      const baseTenantName = input.empresa?.trim() || `Operacao ${input.nome.trim()}`;
      const baseSlug = slugify(baseTenantName) || `trial-${Date.now().toString(36)}`;
      const existingSlug = await queryOneTx<{ id: string }>(
        client,
        "SELECT id FROM tenants WHERE slug = $1 LIMIT 1",
        [baseSlug]
      );
      const slug = existingSlug ? `${baseSlug}-${randomBytes(2).toString("hex")}` : baseSlug;

      const tenant = await queryOneTx<{ id: string; nome: string }>(
        client,
        `INSERT INTO tenants (nome, slug, segmento, plano, config)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)
         RETURNING id, nome`,
        [baseTenantName, slug, input.segmento || null, TRIAL_PLAN_NAME]
      );

      tenantId = tenant?.id || "";
      tenantName = tenant?.nome || baseTenantName;
      trialExpiresAt = getTrialExpiryDate();

      await queryTx(
        client,
        `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, expires_at, notes)
         VALUES ($1, $2, 'TRIAL', NOW(), $3, 'Trial criado automaticamente via WhatsApp')`,
        [tenantId, trialPlan?.id, trialExpiresAt.toISOString()]
      );

      tempPassword = randomBytes(5).toString("base64url");
      const passwordHash = await hash(tempPassword, 12);
      const user = await queryOneTx<{ id: string }>(
        client,
        `INSERT INTO users (tenant_id, email, nome, password_hash, role, ativo)
         VALUES ($1, $2, $3, $4, 'ADMIN', true)
         RETURNING id`,
        [tenantId, email, input.nome.trim(), passwordHash]
      );
      userId = user?.id || "";

      const onboardingDraft = buildTrialOnboardingDraft(input, tenantName);
      const onboardingSession = await queryOneTx<{ id: string }>(
        client,
        `INSERT INTO onboarding_sessions (
          tenant_id,
          current_step,
          step_1_data,
          step_2_data,
          step_3_data,
          step_4_data,
          ai_generated_config,
          status
        ) VALUES ($1, 5, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, 'IN_PROGRESS')
        RETURNING id`,
        [
          tenantId,
          JSON.stringify(onboardingDraft.step1),
          JSON.stringify(onboardingDraft.step2),
          JSON.stringify(onboardingDraft.step3),
          JSON.stringify(onboardingDraft.step4),
          JSON.stringify(onboardingDraft.aiGeneratedConfig),
        ]
      );

      dashboardPath = "/dashboard";

      await client.query("COMMIT");

      if (onboardingSession?.id) {
        try {
          await completeOnboardingSetup({
            tenantId,
            userId,
            onboardingSessionId: onboardingSession.id,
            config: onboardingDraft.aiGeneratedConfig,
            step4Data: onboardingDraft.step4,
          });
        } catch (error) {
          console.error("Erro ao completar onboarding automatico do trial:", error);
          dashboardPath = "/onboarding";
        }
      }

      // Re-open a transaction for lead linkage after the onboarding side effects.
      await client.query("BEGIN");
    }

    leadId = await upsertPortalLeadWithClient(client, input, {
      tenantId,
      userId,
      trialStartedAt: trialExpiresAt ? new Date() : null,
      trialExpiresAt,
      trialStatus: trialExpiresAt ? "active" : null,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const accessToken = await createAutoLoginToken({
    tenantId,
    userId,
    expiresAt: trialExpiresAt || getAutoLoginExpiryDate(),
    metadata: {
      channel: input.qualificationChannel || "whatsapp",
      lead_id: leadId,
      created_workspace: createdWorkspace,
    },
  });

  await markTrialAccessSent(leadId);

  const trialStatus = await getTenantTrialStatus(tenantId);

  return {
    leadId,
    tenantId,
    userId,
    email,
    tempPassword,
    accessLink: accessToken.accessLink,
    expiresAt: trialStatus.expiresAt,
    dashboardPath,
    trialStatus,
    createdWorkspace,
    tenantName,
  };
}

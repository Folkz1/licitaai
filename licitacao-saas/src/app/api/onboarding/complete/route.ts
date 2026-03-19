import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import type { PoolClient } from "pg";
import { pool, queryOne } from "@/lib/db";
import { completeOnboardingSetup } from "@/lib/onboarding-completion";
import {
  clearPublicOnboardingCookie,
  resolveOnboardingContext,
} from "@/lib/public-onboarding";
import { createAutoLoginToken } from "@/lib/trial";

const TRIAL_PLAN_NAME = process.env.TRIAL_PLAN_NAME || "trial_7d";
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 7);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getTrialExpiryDate(baseDate = new Date()) {
  return new Date(baseDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

async function ensureTrialPlan(client: PoolClient) {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM plans WHERE name = $1 LIMIT 1",
    [TRIAL_PLAN_NAME]
  );

  if (existing.rows[0]?.id) {
    return existing.rows[0];
  }

  const inserted = await client.query<{ id: string }>(
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
    ) VALUES ($1, 'Trial 7 Dias', 50, 1, 5, $2::jsonb, 0, false, 200000)
    RETURNING id`,
    [
      TRIAL_PLAN_NAME,
      JSON.stringify({
        trial_days: TRIAL_DAYS,
        daily_analysis_limit: 5,
        enforce_trial: true,
        show_trial_banner: true,
      }),
    ]
  );

  return inserted.rows[0];
}

async function provisionPublicAccount(params: {
  tenantId: string;
  step1: Record<string, unknown>;
}) {
  const razaoSocial = cleanString(params.step1.razao_social) || "Nova conta LicitaAI";
  const setor = cleanString(params.step1.setor) || null;
  const contactName =
    cleanString(params.step1.nome_responsavel) ||
    cleanString(params.step1.nome_fantasia) ||
    razaoSocial;
  const email = cleanEmail(params.step1.email);
  const password = cleanString(params.step1.senha);

  if (!contactName) {
    throw new Error("Informe o nome do responsavel para criar sua conta.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Informe um email valido para acessar a plataforma.");
  }

  if (password.length < 8) {
    throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  }

  const client = await pool.connect();
  const trialExpiresAt = getTrialExpiryDate();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (existingUser.rows[0] && existingUser.rows[0].tenant_id !== params.tenantId) {
      throw new Error("Este email ja possui uma conta. Faca login para continuar.");
    }

    const currentTenant = await client.query<{ slug: string | null }>(
      "SELECT slug FROM tenants WHERE id = $1 LIMIT 1",
      [params.tenantId]
    );

    let nextSlug = currentTenant.rows[0]?.slug || "";
    if (!nextSlug || nextSlug.startsWith("onboarding-")) {
      const baseSlug = slugify(razaoSocial) || `licitai-${randomBytes(3).toString("hex")}`;
      const existingSlug = await client.query<{ id: string }>(
        "SELECT id FROM tenants WHERE slug = $1 AND id <> $2 LIMIT 1",
        [baseSlug, params.tenantId]
      );
      nextSlug = existingSlug.rows[0]
        ? `${baseSlug}-${randomBytes(2).toString("hex")}`
        : baseSlug;
    }

    await client.query(
      `UPDATE tenants
       SET nome = $1,
           slug = $2,
           segmento = $3,
           plano = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [razaoSocial, nextSlug, setor, TRIAL_PLAN_NAME, params.tenantId]
    );

    const passwordHash = await hash(password, 12);
    let userId = existingUser.rows[0]?.id || "";

    if (userId) {
      await client.query(
        `UPDATE users
         SET nome = $1,
             password_hash = $2,
             role = 'ANALYST',
             ativo = true,
             updated_at = NOW()
         WHERE id = $3`,
        [contactName, passwordHash, userId]
      );
    } else {
      const insertedUser = await client.query<{ id: string }>(
        `INSERT INTO users (tenant_id, email, nome, password_hash, role, ativo)
         VALUES ($1, $2, $3, $4, 'ANALYST', true)
         RETURNING id`,
        [params.tenantId, email, contactName, passwordHash]
      );
      userId = insertedUser.rows[0]?.id || "";
    }

    const trialPlan = await ensureTrialPlan(client);
    const existingSubscription = await client.query<{ id: string }>(
      "SELECT id FROM subscriptions WHERE tenant_id = $1 LIMIT 1",
      [params.tenantId]
    );

    if (existingSubscription.rows[0]?.id) {
      await client.query(
        `UPDATE subscriptions
         SET plan_id = $2,
             status = 'TRIAL',
             started_at = NOW(),
             expires_at = $3,
             updated_at = NOW(),
             notes = COALESCE(notes, '') || CASE
               WHEN COALESCE(notes, '') = '' THEN 'Trial criado via onboarding publico'
               ELSE E'\\nTrial criado via onboarding publico'
             END
         WHERE tenant_id = $1`,
        [params.tenantId, trialPlan.id, trialExpiresAt.toISOString()]
      );
    } else {
      await client.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, expires_at, notes)
         VALUES ($1, $2, 'TRIAL', NOW(), $3, 'Trial criado via onboarding publico')`,
        [params.tenantId, trialPlan.id, trialExpiresAt.toISOString()]
      );
    }

    await client.query("COMMIT");

    return {
      userId,
      email,
      trialExpiresAt,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function POST() {
  try {
    const context = await resolveOnboardingContext({ createIfMissing: false });

    if (!context) {
      return NextResponse.json(
        { error: "Sessao de onboarding nao encontrada" },
        { status: 404 }
      );
    }

    const onboardingSession = await queryOne<{
      id: string;
      step_1_data: Record<string, unknown>;
      ai_generated_config: Record<string, unknown>;
      step_4_data: Record<string, unknown>;
    }>(
      `SELECT id, step_1_data, ai_generated_config, step_4_data
       FROM onboarding_sessions
       WHERE tenant_id = $1 AND status = 'IN_PROGRESS'
       ORDER BY created_at DESC
       LIMIT 1`,
      [context.tenantId]
    );

    if (!onboardingSession) {
      return NextResponse.json(
        { error: "Sessao de onboarding nao encontrada" },
        { status: 404 }
      );
    }

    let userId = context.userId;
    let redirect = "/dashboard";
    let trialExpiresAt: string | null = null;

    if (context.mode === "public") {
      const account = await provisionPublicAccount({
        tenantId: context.tenantId,
        step1: onboardingSession.step_1_data || {},
      });
      userId = account.userId;
      trialExpiresAt = account.trialExpiresAt.toISOString();
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Nao foi possivel identificar o usuario do onboarding." },
        { status: 400 }
      );
    }

    const result = await completeOnboardingSetup({
      tenantId: context.tenantId,
      userId,
      onboardingSessionId: onboardingSession.id,
      config: onboardingSession.ai_generated_config || {},
      step4Data: onboardingSession.step_4_data || {},
    });

    if (context.mode === "public") {
      const accessToken = await createAutoLoginToken({
        tenantId: context.tenantId,
        userId,
        expiresAt: trialExpiresAt ? new Date(trialExpiresAt) : undefined,
        metadata: {
          source: "public_onboarding",
        },
      });
      redirect = accessToken.accessLink;
    }

    const response = NextResponse.json({
      success: true,
      redirect,
      busca_triggered: result.buscaTriggered,
      summary: result.summary,
    });

    return clearPublicOnboardingCookie(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("Erro ao completar onboarding:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

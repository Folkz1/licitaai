import { auth } from "@/lib/auth";
import { pool, queryOne } from "@/lib/db";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const PUBLIC_ONBOARDING_COOKIE = "licitai_onboarding";
const TEMP_TENANT_NAME = "Nova conta LicitaAI";
const TEMP_TENANT_PLAN = process.env.TRIAL_PLAN_NAME || "trial_7d";

type CookieStoreLike = {
  get(name: string): { value: string } | undefined;
};

type SessionRow = {
  id: string;
  tenant_id: string;
  current_step: number;
  step_1_data: Record<string, unknown>;
  step_2_data: Record<string, unknown>;
  step_3_data: Record<string, unknown>;
  step_4_data: Record<string, unknown>;
  step_5_data: Record<string, unknown>;
  ai_generated_config: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type TenantRow = {
  id: string;
  nome: string;
  onboarding_completed: boolean;
};

type SignedCookiePayload = {
  tenantId: string;
};

export type OnboardingContext = {
  mode: "authenticated" | "public";
  tenantId: string;
  userId: string | null;
  session: SessionRow;
  tenant: TenantRow | null;
  isCompleted: boolean;
  cookieValue: string | null;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET nao configurado para onboarding publico.");
  }
  return secret;
}

function signPayload(payload: SignedCookiePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function parseSignedCookie(value: string | null | undefined): SignedCookiePayload | null {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(".");
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedCookiePayload;
  } catch {
    return null;
  }
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

async function ensureOnboardingSession(tenantId: string) {
  const tenant = await queryOne<TenantRow>(
    `SELECT id, nome, onboarding_completed
     FROM tenants
     WHERE id = $1
     LIMIT 1`,
    [tenantId]
  );

  if (!tenant) {
    return null;
  }

  let session = await queryOne<SessionRow>(
    `SELECT *
     FROM onboarding_sessions
     WHERE tenant_id = $1 AND status = 'IN_PROGRESS'
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId]
  );

  if (!session) {
    session = await queryOne<SessionRow>(
      `INSERT INTO onboarding_sessions (tenant_id, current_step, status)
       VALUES ($1, 1, 'IN_PROGRESS')
       RETURNING *`,
      [tenantId]
    );
  }

  if (!session) {
    return null;
  }

  return {
    session,
    tenant,
    isCompleted: Boolean(tenant.onboarding_completed),
  };
}

async function createPublicWorkspace() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const baseSlug = slugify(`onboarding-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`);
    const tenant = await client.query<Pick<TenantRow, "id" | "nome">>(
      `INSERT INTO tenants (nome, slug, plano, config)
       VALUES ($1, $2, $3, '{}'::jsonb)
       RETURNING id, nome`,
      [TEMP_TENANT_NAME, baseSlug, TEMP_TENANT_PLAN]
    );

    const tenantId = tenant.rows[0]?.id;
    if (!tenantId) {
      throw new Error("Nao foi possivel criar tenant temporario de onboarding.");
    }

    const session = await client.query<SessionRow>(
      `INSERT INTO onboarding_sessions (tenant_id, current_step, status)
       VALUES ($1, 1, 'IN_PROGRESS')
       RETURNING *`,
      [tenantId]
    );

    await client.query("COMMIT");

    return {
      tenantId,
      tenant: {
        id: tenantId,
        nome: tenant.rows[0].nome,
        onboarding_completed: false,
      },
      session: session.rows[0],
      isCompleted: false,
      cookieValue: signPayload({ tenantId }),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getCookieStore(cookieStore?: CookieStoreLike) {
  if (cookieStore) {
    return cookieStore;
  }

  return cookies();
}

export async function resolveOnboardingContext(options?: {
  createIfMissing?: boolean;
  cookieStore?: CookieStoreLike;
}) {
  const session = await auth();

  if (session?.user?.tenantId) {
    const existing = await ensureOnboardingSession(session.user.tenantId);
    if (!existing) {
      return null;
    }

    return {
      mode: "authenticated" as const,
      tenantId: session.user.tenantId,
      userId: session.user.id,
      session: existing.session,
      tenant: existing.tenant,
      isCompleted: existing.isCompleted,
      cookieValue: null,
    };
  }

  const cookieStore = await getCookieStore(options?.cookieStore);
  const parsed = parseSignedCookie(cookieStore.get(PUBLIC_ONBOARDING_COOKIE)?.value);

  if (parsed?.tenantId) {
    const existing = await ensureOnboardingSession(parsed.tenantId);
    if (existing) {
      return {
        mode: "public" as const,
        tenantId: parsed.tenantId,
        userId: null,
        session: existing.session,
        tenant: existing.tenant,
        isCompleted: existing.isCompleted,
        cookieValue: null,
      };
    }
  }

  if (!options?.createIfMissing) {
    return null;
  }

  const created = await createPublicWorkspace();

  return {
    mode: "public" as const,
    tenantId: created.tenantId,
    userId: null,
    session: created.session,
    tenant: created.tenant,
    isCompleted: created.isCompleted,
    cookieValue: created.cookieValue,
  };
}

export function applyPublicOnboardingCookie(response: Response, cookieValue: string | null) {
  if (!cookieValue || !("cookies" in response)) {
    return response;
  }

  const nextResponse = response as Response & {
    cookies?: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
      delete: (name: string, options?: Record<string, unknown>) => void;
    };
  };

  nextResponse.cookies?.set(PUBLIC_ONBOARDING_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export function clearPublicOnboardingCookie(response: Response) {
  if (!("cookies" in response)) {
    return response;
  }

  const nextResponse = response as Response & {
    cookies?: {
      delete: (name: string, options?: Record<string, unknown>) => void;
    };
  };

  nextResponse.cookies?.delete(PUBLIC_ONBOARDING_COOKIE);
  return response;
}

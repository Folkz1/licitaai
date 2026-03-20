import { NextRequest, NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { encode } from "@auth/core/jwt";
import { createHash } from "crypto";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function resolveAppUrl(request: NextRequest): string {
  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host) {
    const proto = request.nextUrl.protocol.replace(":", "") || "https";
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const accessToken = await queryOne<{
    id: string;
    user_id: string;
    tenant_id: string;
    expires_at: string;
    user_email: string;
    user_name: string;
    role: string;
    tenant_name: string;
    onboarding_completed: boolean;
  }>(
    `SELECT
       at.id,
       at.user_id,
       at.tenant_id,
       at.expires_at,
       u.email as user_email,
       u.nome as user_name,
       u.role,
       t.nome as tenant_name,
       t.onboarding_completed
     FROM access_tokens at
     JOIN users u ON u.id = at.user_id
     JOIN tenants t ON t.id = at.tenant_id
     WHERE at.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (!accessToken) {
    return NextResponse.redirect(new URL("/login?trial=link-invalido", resolveAppUrl(request)));
  }

  if (new Date(accessToken.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(new URL("/login?trial=link-expirado", resolveAppUrl(request)));
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login?trial=auth-indisponivel", resolveAppUrl(request)));
  }

  const appUrl = resolveAppUrl(request);
  const useSecureCookies = appUrl.startsWith("https://") && !appUrl.includes("localhost");
  const cookieName = useSecureCookies ? "__Secure-authjs.session-token" : "authjs.session-token";

  const sessionToken = await encode({
    secret,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE,
    token: {
      sub: accessToken.user_id,
      email: accessToken.user_email,
      name: accessToken.user_name,
      role: accessToken.role,
      tenantId: accessToken.tenant_id,
      tenantName: accessToken.tenant_name,
    },
  });

  await query(
    `UPDATE access_tokens
     SET used_at = NOW()
     WHERE id = $1`,
    [accessToken.id]
  ).catch(() => {});

  // Track prospect access in portal_leads
  await query(
    `UPDATE portal_leads
     SET prospect_status = CASE WHEN prospect_status = 'enviado' THEN 'acessou' ELSE prospect_status END,
         first_access_at = COALESCE(first_access_at, NOW()),
         last_access_at = NOW(),
         access_count = COALESCE(access_count, 0) + 1,
         updated_at = NOW()
     WHERE user_id = $1`,
    [accessToken.user_id]
  ).catch(() => {});

  const redirectPath = accessToken.onboarding_completed ? "/dashboard" : "/onboarding";
  const response = NextResponse.redirect(new URL(redirectPath, appUrl));

  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies,
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}

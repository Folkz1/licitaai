/**
 * Script para testar o onboarding via API com sessao real do Auth.js.
 * Uso: npx tsx test-onboarding.ts
 */

import { Pool } from "pg";
import { hash } from "bcryptjs";
import crypto from "node:crypto";

const BASE_URL = "http://localhost:3000";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution?sslmode=disable";

type CookieJar = Map<string, string>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function storeCookies(jar: CookieJar, response: Response) {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const cookies = getSetCookie ? getSetCookie() : [];

  for (const rawCookie of cookies) {
    const firstChunk = rawCookie.split(";")[0];
    const separatorIndex = firstChunk.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = firstChunk.slice(0, separatorIndex).trim();
    const value = firstChunk.slice(separatorIndex + 1).trim();
    jar.set(name, value);
  }
}

function cookieHeader(jar: CookieJar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function requestJson(
  url: string,
  jar: CookieJar,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  if (jar.size > 0) {
    headers.set("Cookie", cookieHeader(jar));
  }

  const response = await fetch(url, {
    ...init,
    headers,
    redirect: init.redirect ?? "manual",
  });

  storeCookies(jar, response);

  const contentType = response.headers.get("content-type") || "";
  let body: unknown;
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return { response, body };
}

async function ensureTestUser(pool: Pool) {
  const email = "codex-onboarding@licitaai.com";
  const password = "teste123";
  const passwordHash = await hash(password, 12);

  const existingUser = await pool.query(
    "SELECT id, tenant_id FROM users WHERE email = $1",
    [email]
  );

  if (existingUser.rows[0]) {
    await pool.query(
      "UPDATE users SET password_hash = $1, ativo = true WHERE email = $2",
      [passwordHash, email]
    );

    return { email, password, tenantId: existingUser.rows[0].tenant_id as string };
  }

  const tenantName = "Codex Onboarding Teste";
  const tenantSlug = `${slugify(tenantName)}-${crypto.randomBytes(3).toString("hex")}`;
  const tenant = await pool.query(
    "INSERT INTO tenants (nome, slug, ativo, plano) VALUES ($1, $2, true, 'basic') RETURNING id",
    [tenantName, tenantSlug]
  );

  await pool.query(
    `INSERT INTO users (tenant_id, email, nome, password_hash, role, ativo)
     VALUES ($1, $2, $3, $4, 'ANALYST', true)`,
    [tenant.rows[0].id, email, "Codex Teste", passwordHash]
  );

  return { email, password, tenantId: tenant.rows[0].id as string };
}

async function login(email: string, password: string, jar: CookieJar) {
  const csrfRequest = await requestJson(`${BASE_URL}/api/auth/csrf`, jar);
  const csrfToken = (csrfRequest.body as { csrfToken: string }).csrfToken;

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    redirect: "false",
    json: "true",
    callbackUrl: `${BASE_URL}/`,
  });

  const loginResponse = await requestJson(`${BASE_URL}/api/auth/callback/credentials`, jar, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE_URL,
    },
    body: body.toString(),
  });

  const location = loginResponse.response.headers.get("location");
  const hasSessionCookie = jar.has("authjs.session-token") || jar.has("__Secure-authjs.session-token");

  if (loginResponse.response.status !== 302 || !hasSessionCookie || location?.includes("error=")) {
    throw new Error(
      `Falha no login. Status=${loginResponse.response.status}, location=${location}, cookies=${cookieHeader(jar)}`
    );
  }
}

async function testOnboarding() {
  console.log("=== Teste do Onboarding via API ===\n");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const jar: CookieJar = new Map();

  try {
    console.log("1. Preparando usuario de teste...");
    const user = await ensureTestUser(pool);
    console.log(`Usuario: ${user.email} (tenant: ${user.tenantId})`);

    console.log("\n2. Fazendo login...");
    await login(user.email, user.password, jar);
    console.log(`Cookies ativos: ${Array.from(jar.keys()).join(", ")}`);

    console.log("\n3. Testando GET /api/onboarding/session...");
    const sessionRes = await requestJson(`${BASE_URL}/api/onboarding/session`, jar);
    console.log(`Status: ${sessionRes.response.status}`);
    console.log("Response:", JSON.stringify(sessionRes.body, null, 2));

    console.log("\n4. Testando POST /api/onboarding/session - Step 1...");
    const step1Res = await requestJson(`${BASE_URL}/api/onboarding/session`, jar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: 1,
        data: {
          razao_social: "Empresa Teste Ltda",
          nome_fantasia: "Empresa Teste",
          porte: "ME",
          setor: "Tecnologia",
          descricao_livre: "Empresa de desenvolvimento de software",
        },
      }),
    });
    console.log(`Status: ${step1Res.response.status}`);
    console.log("Response:", JSON.stringify(step1Res.body, null, 2));

    console.log("\n5. Testando POST /api/onboarding/session - Step 2...");
    const step2Res = await requestJson(`${BASE_URL}/api/onboarding/session`, jar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: 2,
        data: {
          ramo_principal: "TI",
          ramo_secundario: ["CONSULTORIA"],
          experiencia_pregao: true,
          tipos_clientes: ["Publico", "Privado"],
        },
      }),
    });
    console.log(`Status: ${step2Res.response.status}`);
    console.log("Response:", JSON.stringify(step2Res.body, null, 2));

    console.log("\n6. Testando POST /api/onboarding/session - Step 3...");
    const step3Res = await requestJson(`${BASE_URL}/api/onboarding/session`, jar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: 3,
        data: {
          produtos_servicos:
            "Desenvolvimento de software, manutencao de sistemas, consultoria de TI",
          palavras_chave_manual: ["software", "desenvolvimento", "sistema"],
          exclusoes: "hardware, redes, instalacao de cabos",
        },
      }),
    });
    console.log(`Status: ${step3Res.response.status}`);
    console.log("Response:", JSON.stringify(step3Res.body, null, 2));

    console.log("\n7. Testando POST /api/onboarding/session - Step 4...");
    const step4Res = await requestJson(`${BASE_URL}/api/onboarding/session`, jar, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: 4,
        data: {
          ufs_interesse: ["SP", "RJ", "MG"],
          municipios_interesse: ["Sao Paulo", "Rio de Janeiro"],
          modalidades: [1, 6],
          valor_minimo: 10000,
          valor_maximo: 500000,
          dias_retroativos: 30,
        },
      }),
    });
    console.log(`Status: ${step4Res.response.status}`);
    console.log("Response:", JSON.stringify(step4Res.body, null, 2));

    console.log("\n8. Testando POST /api/onboarding/generate...");
    const generateRes = await requestJson(`${BASE_URL}/api/onboarding/generate`, jar, {
      method: "POST",
    });
    console.log(`Status: ${generateRes.response.status}`);
    console.log("Response:", JSON.stringify(generateRes.body, null, 2));

    console.log("\n9. Testando POST /api/onboarding/complete...");
    const completeRes = await requestJson(`${BASE_URL}/api/onboarding/complete`, jar, {
      method: "POST",
    });
    console.log(`Status: ${completeRes.response.status}`);
    console.log("Response:", JSON.stringify(completeRes.body, null, 2));

    if (completeRes.response.status !== 200) {
      throw new Error("Onboarding nao concluiu com sucesso.");
    }

    console.log("\n=== Teste Finalizado com Sucesso! ===");
  } catch (error) {
    console.error("\nErro durante o teste:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testOnboarding();

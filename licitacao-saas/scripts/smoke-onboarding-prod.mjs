import { Pool } from "pg";
import { hash } from "bcryptjs";
import crypto from "node:crypto";

const args = process.argv.slice(2);

function readArg(name) {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  return direct ? direct.slice(name.length + 1) : undefined;
}

const baseUrl =
  readArg("--url") ||
  process.env.BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://licitai.mbest.site";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function storeCookies(jar, response) {
  const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];

  for (const rawCookie of cookies) {
    const firstChunk = rawCookie.split(";")[0];
    const separatorIndex = firstChunk.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = firstChunk.slice(0, separatorIndex).trim();
    const value = firstChunk.slice(separatorIndex + 1).trim();
    jar.set(name, value);
  }
}

function cookieHeader(jar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(url, jar, init = {}) {
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
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { response, body };
}

async function ensureSmokeUser(pool) {
  const email = "codex-prod-onboarding@licitaai.com";
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

    return { email, password, tenantId: existingUser.rows[0].tenant_id };
  }

  const tenantName = "Codex Prod Onboarding";
  const tenantSlug = `${slugify(tenantName)}-${crypto.randomBytes(3).toString("hex")}`;
  const tenant = await pool.query(
    "INSERT INTO tenants (nome, slug, ativo, plano) VALUES ($1, $2, true, 'basic') RETURNING id",
    [tenantName, tenantSlug]
  );

  await pool.query(
    `INSERT INTO users (tenant_id, email, nome, password_hash, role, ativo)
     VALUES ($1, $2, $3, $4, 'ADMIN', true)`,
    [tenant.rows[0].id, email, "Codex Prod", passwordHash]
  );

  return { email, password, tenantId: tenant.rows[0].id };
}

async function login(email, password, jar) {
  const csrfRequest = await request(`${baseUrl}/api/auth/csrf`, jar);
  const csrfToken = csrfRequest.body?.csrfToken;

  if (!csrfToken) {
    throw new Error(`CSRF token not returned by ${baseUrl}`);
  }

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    redirect: "false",
    json: "true",
    callbackUrl: `${baseUrl}/`,
  });

  const loginResponse = await request(`${baseUrl}/api/auth/callback/credentials`, jar, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: baseUrl,
    },
    body: body.toString(),
  });

  const location = loginResponse.response.headers.get("location");
  const hasSessionCookie =
    jar.has("authjs.session-token") || jar.has("__Secure-authjs.session-token");

  if (
    loginResponse.response.status !== 302 ||
    !hasSessionCookie ||
    location?.includes("error=")
  ) {
    throw new Error(
      `Login failed. status=${loginResponse.response.status} location=${location}`
    );
  }
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const jar = new Map();

  try {
    const user = await ensureSmokeUser(pool);
    await login(user.email, user.password, jar);

    const pageResponse = await fetch(`${baseUrl}/onboarding`, { redirect: "manual" });
    const csp = pageResponse.headers.get("content-security-policy");
    const cspReportOnly = pageResponse.headers.get("content-security-policy-report-only");

    console.log(`baseUrl=${baseUrl}`);
    console.log(`csp=${csp || "(none)"}`);
    console.log(`cspReportOnly=${cspReportOnly || "(none)"}`);

    const steps = [
      {
        step: 1,
        data: {
          razao_social: "Empresa Teste Ltda",
          nome_fantasia: "Empresa Teste",
          porte: "ME",
          setor: "Tecnologia",
          descricao_livre: "Empresa de software",
        },
      },
      {
        step: 2,
        data: {
          ramo_principal: "TI",
          ramo_secundario: ["CONSULTORIA"],
          experiencia_pregao: true,
          tipos_clientes: ["Publico", "Privado"],
        },
      },
      {
        step: 3,
        data: {
          produtos_servicos: "Desenvolvimento de software, manutencao de sistemas",
          palavras_chave_manual: ["software", "sistema"],
          exclusoes: "hardware",
        },
      },
      {
        step: 4,
        data: {
          ufs_interesse: ["SP", "RJ"],
          municipios_interesse: ["Sao Paulo"],
          modalidades: [1, 6],
          valor_minimo: 10000,
          valor_maximo: 500000,
          dias_retroativos: 30,
        },
      },
    ];

    const sessionRes = await request(`${baseUrl}/api/onboarding/session`, jar);
    console.log(`session=${sessionRes.response.status}`);

    for (const item of steps) {
      const res = await request(`${baseUrl}/api/onboarding/session`, jar, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      console.log(`step${item.step}=${res.response.status}`);
    }

    const generateRes = await request(`${baseUrl}/api/onboarding/generate`, jar, {
      method: "POST",
    });
    console.log(`generate=${generateRes.response.status}`);

    const completeRes = await request(`${baseUrl}/api/onboarding/complete`, jar, {
      method: "POST",
    });
    console.log(`complete=${completeRes.response.status}`);
    console.log(`completeBody=${JSON.stringify(completeRes.body)}`);

    if (completeRes.response.status !== 200) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

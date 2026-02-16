/**
 * Script para testar o onboarding via API
 * Uso: npx tsx test-onboarding.ts
 */

import { Pool } from "pg";
import { hash } from "bcryptjs";

const BASE_URL = "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution?sslmode=disable";

async function getCsrfToken(cookies: string[]) {
  const res = await fetch(`${BASE_URL}/api/auth/csrf`, {
    headers: {
      "Cookie": cookies.join("; ")
    }
  });
  const data = await res.json();
  return data.csrfToken;
}

async function login(email: string, password: string, csrfToken: string, cookies: string[]) {
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies.join("; "),
      "Origin": BASE_URL
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      json: "true"
    }),
    redirect: "manual",
    credentials: "include"
  });

  console.log(`Login response status: ${res.status}`);
  const setCookies = res.headers.getSetCookie?.() || [];
  console.log(`Set-Cookie headers: ${JSON.stringify(setCookies)}`);
  return setCookies;
}

async function testOnboarding() {
  console.log("=== Teste do Onboarding via API ===\n");

  const pool = new Pool({ connectionString: DATABASE_URL });
  let cookies: string[] = [];

  try {
    // 1. Buscar usuário de teste
    console.log("1. Buscando usuário de teste...");
    const userResult = await pool.query(
      "SELECT u.id, u.email, u.tenant_id, t.nome as tenant_nome FROM users u JOIN tenants t ON t.id = u.tenant_id LIMIT 1"
    );
    
    if (userResult.rows.length === 0) {
      console.log("Nenhum usuário encontrado! Criando...");
      // Criar tenant e usuário
      const tenantResult = await pool.query(
        "INSERT INTO tenants (nome) VALUES ('Empresa Teste') RETURNING id"
      );
      const tenantId = tenantResult.rows[0].id;
      const passwordHash = await hash("teste123", 12);
      
      await pool.query(
        "INSERT INTO users (tenant_id, email, nome, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
        [tenantId, "teste@exemplo.com", "Usuario Teste", passwordHash, "ADMIN"]
      );
      
      console.log("Usuário criado: teste@exemplo.com / teste123");
      
      var testEmail = "teste@exemplo.com";
      var testPassword = "teste123";
    } else {
      const user = userResult.rows[0];
      console.log(`Usuário encontrado: ${user.email} (tenant: ${user.tenant_nome})`);
      var testEmail = user.email;
      // Preciso criar senha para esse usuário se não tiver
      const passwordHash = await hash("teste123", 12);
      await pool.query(
        "UPDATE users SET password_hash = $1 WHERE email = $2",
        [passwordHash, testEmail]
      );
      var testPassword = "teste123";
    }

    // 2. Login para obter sessão
    console.log("\n2. Fazendo login...");
    const csrfToken = await getCsrfToken(cookies);
    console.log(`CSRF Token: ${csrfToken.substring(0, 20)}...`);
    
    const setCookies = await login(testEmail, testPassword, csrfToken, cookies);
    cookies = [...cookies, ...setCookies];
    console.log(`Cookies recebidos: ${cookies.length}`);
    
    // 3. Testar GET /api/onboarding/session
    console.log("\n3. Testando GET /api/onboarding/session...");
    const sessionRes = await fetch(`${BASE_URL}/api/onboarding/session`, {
      headers: {
        "Cookie": cookies.join("; ")
      }
    });
    console.log(`Status: ${sessionRes.status}`);
    const sessionData = await sessionRes.json();
    console.log("Response:", JSON.stringify(sessionData, null, 2));

    // 4. Testar POST /api/onboarding/session - Step 1 (Dados da empresa)
    console.log("\n4. Testando POST /api/onboarding/session - Step 1...");
    const step1Data = {
      step: 1,
      data: {
        razao_social: "Empresa Teste Ltda",
        nome_fantasia: "Empresa Teste",
        porte: "ME",
        setor: "Tecnologia",
        descricao_livre: "Empresa de desenvolvimento de software"
      }
    };
    
    const step1Res = await fetch(`${BASE_URL}/api/onboarding/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies.join("; ")
      },
      body: JSON.stringify(step1Data)
    });
    console.log(`Status: ${step1Res.status}`);
    const step1Response = await step1Res.json();
    console.log("Response:", JSON.stringify(step1Response, null, 2));

    // 5. Testar POST /api/onboarding/session - Step 2 (Ramo de atuação)
    console.log("\n5. Testando POST /api/onboarding/session - Step 2...");
    const step2Data = {
      step: 2,
      data: {
        ramo_principal: "TI",
        ramo_secundario: ["CONSULTORIA"],
        experiencia_pregao: true,
        tipos_clientes: ["Público", "Privado"]
      }
    };
    
    const step2Res = await fetch(`${BASE_URL}/api/onboarding/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies.join("; ")
      },
      body: JSON.stringify(step2Data)
    });
    console.log(`Status: ${step2Res.status}`);
    const step2Response = await step2Res.json();
    console.log("Response:", JSON.stringify(step2Response, null, 2));

    // 6. Testar POST /api/onboarding/session - Step 3 (Produtos/Serviços)
    console.log("\n6. Testando POST /api/onboarding/session - Step 3...");
    const step3Data = {
      step: 3,
      data: {
        produtos_servicos: "Desenvolvimento de software, manutenção de sistemas, consultoria de TI",
        palavras_chave_manual: ["software", "desenvolvimento", "sistema"],
        exclusoes: "hardware, redes, instalação de cabos"
      }
    };
    
    const step3Res = await fetch(`${BASE_URL}/api/onboarding/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies.join("; ")
      },
      body: JSON.stringify(step3Data)
    });
    console.log(`Status: ${step3Res.status}`);
    const step3Response = await step3Res.json();
    console.log("Response:", JSON.stringify(step3Response, null, 2));

    // 7. Testar POST /api/onboarding/session - Step 4 (Preferências)
    console.log("\n7. Testando POST /api/onboarding/session - Step 4...");
    const step4Data = {
      step: 4,
      data: {
        ufs_interesse: ["SP", "RJ", "MG"],
        municipios_interesse: ["São Paulo", "Rio de Janeiro"],
        modalidades: [1, 6],
        valor_minimo: 10000,
        valor_maximo: 500000,
        dias_retroativos: 30
      }
    };
    
    const step4Res = await fetch(`${BASE_URL}/api/onboarding/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookies.join("; ")
      },
      body: JSON.stringify(step4Data)
    });
    console.log(`Status: ${step4Res.status}`);
    const step4Response = await step4Res.json();
    console.log("Response:", JSON.stringify(step4Response, null, 2));

    // 8. Testar POST /api/onboarding/generate (Gerar config com IA)
    console.log("\n8. Testando POST /api/onboarding/generate...");
    const generateRes = await fetch(`${BASE_URL}/api/onboarding/generate`, {
      method: "POST",
      headers: {
        "Cookie": cookies.join("; ")
      }
    });
    console.log(`Status: ${generateRes.status}`);
    const generateData = await generateRes.json();
    console.log("Response:", JSON.stringify(generateData, null, 2));

    // 9. Testar POST /api/onboarding/complete (Completar onboarding)
    console.log("\n9. Testando POST /api/onboarding/complete...");
    const completeRes = await fetch(`${BASE_URL}/api/onboarding/complete`, {
      method: "POST",
      headers: {
        "Cookie": cookies.join("; ")
      }
    });
    console.log(`Status: ${completeRes.status}`);
    const completeData = await completeRes.json();
    console.log("Response:", JSON.stringify(completeData, null, 2));

    console.log("\n=== Teste Finalizado com Sucesso! ===");

  } catch (error) {
    console.error("\nErro durante o teste:", error);
  } finally {
    await pool.end();
  }
}

testOnboarding();

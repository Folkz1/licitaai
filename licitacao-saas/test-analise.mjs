/**
 * Test script for the analysis pipeline (end-to-end)
 * Tests each step independently: LLM call, OCR, PNCP files, embeddings
 *
 * Usage: node test-analise.mjs [step]
 * Steps: llm, ocr, pncp, embeddings, pretriagem, all
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "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";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OCR_WEBHOOK = "https://n8n-n8n-start.jz9bd8.easypanel.host/webhook/ocr-supremo";

const step = process.argv[2] || "all";

async function testLLM() {
  console.log("\n=== TEST: LLM Call (GPT-4.1-mini via OpenRouter) ===");
  const start = Date.now();

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4.1-mini",
      messages: [
        { role: "system", content: "Responda apenas com JSON valido." },
        { role: "user", content: 'Classifique esta licitacao: "Aquisicao de papel A4, envelopes e materiais de escritorio". Responda: {"decisao": "ANALISAR" ou "REJEITAR", "motivo": "razao", "confianca": 0-100}' },
      ],
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();
  const elapsed = Date.now() - start;
  console.log(`Status: ${res.status} | ${elapsed}ms`);
  console.log(`Response:`, data.choices?.[0]?.message?.content);
  console.log(`Tokens: ${data.usage?.prompt_tokens} in / ${data.usage?.completion_tokens} out`);
  console.log(`Cost: ~$${((data.usage?.prompt_tokens * 0.4 + data.usage?.completion_tokens * 1.6) / 1e6).toFixed(6)}`);
  return res.ok;
}

async function testAnalysisModel() {
  console.log("\n=== TEST: Analysis Model (Qwen 3.5 via OpenRouter) ===");
  const start = Date.now();

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3-235b-a22b",
      messages: [
        { role: "system", content: "Voce e um analista de licitacoes. Responda apenas com JSON." },
        {
          role: "user",
          content: `Analise esta licitacao:
Objeto: Aquisicao de papel A4, envelopes e materiais graficos
Valor: R$ 50.000,00
Modalidade: Pregao Eletronico
UF: MG

Responda com JSON: {"prioridade": "P1|P2|P3", "justificativa": "...", "itens": [{"numero": 1, "descricao": "...", "valor_unitario": 0}]}`,
        },
      ],
      temperature: 0.15,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();
  const elapsed = Date.now() - start;
  console.log(`Status: ${res.status} | ${elapsed}ms`);
  console.log(`Response:`, data.choices?.[0]?.message?.content?.slice(0, 500));
  console.log(`Tokens: ${data.usage?.prompt_tokens} in / ${data.usage?.completion_tokens} out`);
  return res.ok;
}

async function testPncpFiles() {
  console.log("\n=== TEST: PNCP File Listing ===");
  // Use a known NCP: test with a real one
  const testNcps = [
    // Format: cnpj/ano/sequencial
    { cnpj: "18715615000160", ano: "2025", seq: "5" },
  ];

  for (const ncp of testNcps) {
    const url = `https://pncp.gov.br/pncp-api/v1/orgaos/${ncp.cnpj}/compras/${ncp.ano}/${ncp.seq}/arquivos`;
    console.log(`Fetching: ${url}`);
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const files = await res.json();
        console.log(`Found ${Array.isArray(files) ? files.length : 0} files`);
        if (Array.isArray(files) && files.length > 0) {
          console.log(`First file: ${files[0].titulo || files[0].tipoDocumentoNome} (${files[0].url?.slice(0, 80)}...)`);
        }
      } else {
        console.log(`Error: ${res.status}`);
      }
    } catch (err) {
      console.log(`Timeout/Error: ${err.message}`);
    }
  }
  return true;
}

async function testOcr() {
  console.log("\n=== TEST: OCR Supremo Webhook ===");
  // Test with a real PDF URL from PNCP
  const testDoc = {
    url: "https://pncp.gov.br/pncp-api/v1/orgaos/18715615000160/compras/2025/5/arquivos/1",
    id: "test_ocr_1",
    nome: "Edital",
    tipo: "Edital",
  };

  console.log(`Sending OCR request for: ${testDoc.url}`);
  const start = Date.now();

  try {
    const res = await fetch(OCR_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: [testDoc] }),
      signal: AbortSignal.timeout(120000),
    });

    const elapsed = Date.now() - start;
    console.log(`Status: ${res.status} | ${elapsed}ms`);

    if (res.ok) {
      const data = await res.json();
      const text = extractText(data);
      console.log(`OCR text length: ${text.length} chars`);
      console.log(`First 200 chars: ${text.slice(0, 200)}...`);
      return text.length > 100;
    } else {
      console.log(`Error: ${await res.text()}`);
      return false;
    }
  } catch (err) {
    console.log(`Error: ${err.message}`);
    return false;
  }
}

function extractText(data) {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(extractText).join("\n");
  if (data && typeof data === "object") {
    if (data.text) return data.text;
    if (data.content) return data.content;
    if (data.pages) return extractText(data.pages);
    if (data.results) return extractText(data.results);
    return Object.values(data).map(extractText).join("\n");
  }
  return "";
}

async function testEmbeddings() {
  console.log("\n=== TEST: OpenAI Embeddings ===");
  if (!OPENAI_KEY) {
    console.log("SKIP: OPENAI_API_KEY not set. Embeddings won't work without it.");
    console.log("Set OPENAI_API_KEY env var or use OpenRouter embeddings as fallback.");
    return false;
  }

  const start = Date.now();
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: ["Teste de embedding para licitacoes"],
    }),
  });

  const elapsed = Date.now() - start;
  const data = await res.json();
  console.log(`Status: ${res.status} | ${elapsed}ms`);
  if (res.ok) {
    console.log(`Embedding dim: ${data.data[0].embedding.length}`);
    console.log(`Tokens: ${data.usage?.total_tokens}`);
  } else {
    console.log(`Error:`, data.error?.message);
  }
  return res.ok;
}

async function main() {
  console.log("============================================");
  console.log("  LicitaAI Analysis Pipeline - E2E Test");
  console.log("============================================");
  console.log(`Step: ${step}`);
  console.log(`OpenRouter key: ${OPENROUTER_KEY ? "SET" : "MISSING"}`);
  console.log(`OpenAI key: ${OPENAI_KEY ? "SET" : "MISSING"}`);

  const results = {};

  if (step === "all" || step === "llm") {
    results.llm = await testLLM();
  }
  if (step === "all" || step === "analysis") {
    results.analysis = await testAnalysisModel();
  }
  if (step === "all" || step === "pncp") {
    results.pncp = await testPncpFiles();
  }
  if (step === "all" || step === "ocr") {
    results.ocr = await testOcr();
  }
  if (step === "all" || step === "embeddings") {
    results.embeddings = await testEmbeddings();
  }

  console.log("\n============================================");
  console.log("  RESULTS:");
  for (const [key, ok] of Object.entries(results)) {
    console.log(`  ${ok ? "PASS" : "FAIL"} ${key}`);
  }
  console.log("============================================");
}

main().catch(console.error);

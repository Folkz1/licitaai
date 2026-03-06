/**
 * PNCP Analysis Module - Replaces N8N "Análise Editais PNCP" workflow
 *
 * Pipeline:
 * 1. Load tenant context (config, keywords, custom prompts)
 * 2. Select pending licitações (NOVA + passou_pre_triagem + no analysis)
 * 3. Pre-triagem via LLM (quick relevance filter)
 * 4. For approved: fetch PNCP files → OCR Supremo → RAG chunks → full AI analysis
 * 5. Normalize output → upsert analises + itens_licitacao
 */

import { query, queryOne } from "@/lib/db";

// --- Config ---

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OCR_WEBHOOK = "https://n8n-n8n-start.jz9bd8.easypanel.host/webhook/ocr-supremo";

const PRE_TRIAGEM_MODEL = process.env.PRETRIAGEM_MODEL || "openai/gpt-4.1-mini";
const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL || "openai/gpt-4.1-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

const RAG_CHUNK_SIZE = 4000;
const RAG_CHUNK_OVERLAP = 400;
const RAG_TOP_K = 8;
const MAX_OCR_TEXT = 180000; // 180KB limit

// --- Types ---

interface TenantContext {
  tenant_id: string;
  tenant_nome: string;
  segmento: string;
  config: Record<string, unknown>;
  palavras_inclusao: string[];
  palavras_exclusao: string[];
  prompt_pre_triagem: string | null;
  prompt_analise_completa: string | null;
  output_schema: string | null;
}

interface PendingLicitacao {
  id: string;
  numero_controle_pncp: string;
  cnpj_orgao: string;
  ano_compra: number;
  sequencial_compra: number;
  orgao_nome: string;
  objeto_compra: string;
  valor_total_estimado: number;
  modalidade_contratacao: string;
  tipo_participacao: string;
  uf: string;
  municipio: string;
  data_publicacao: string;
  data_encerramento_proposta: string | null;
  link_sistema_origem: string | null;
  dias_restantes: number | null;
}

interface PreTriagemResult {
  decisao: "ANALISAR" | "REJEITAR";
  motivo: string;
  confianca: number;
}

interface AnaliseStats {
  total_pendentes: number;
  pre_triagem_aprovadas: number;
  pre_triagem_rejeitadas: number;
  analisadas: number;
  erros_ocr: number;
  erros_analise: number;
  sem_edital: number;
}

export interface AnaliseResult {
  success: boolean;
  stats: AnaliseStats;
  error?: string;
}

// --- Helpers ---

function normalize(text: string): string {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function callLLM(
  model: string,
  messages: { role: string; content: string }[],
  temperature = 0.1,
  maxTokens = 4096
): Promise<{ content: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(300000), // 5 min for large docs
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "{}",
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    },
  };
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  // Use OpenAI directly if key available, otherwise fall back to OpenRouter
  const useOpenAI = !!OPENAI_KEY;
  const url = useOpenAI
    ? "https://api.openai.com/v1/embeddings"
    : "https://openrouter.ai/api/v1/embeddings";
  const key = useOpenAI ? OPENAI_KEY : OPENROUTER_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: useOpenAI ? EMBEDDING_MODEL : `openai/${EMBEDDING_MODEL}`,
      input: texts,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embeddings ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

function chunkText(text: string, size = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP): string[] {
  if (!text || text.length === 0) return [];
  if (text.length <= size) return [text];

  // Paragraph-aware chunking (matches N8N behavior)
  const chunks: string[] = [];
  const paras = text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);

  function splitWithOverlap(t: string): string[] {
    const out: string[] = [];
    let start = 0;
    while (start < t.length) {
      const end = Math.min(start + size, t.length);
      out.push(t.slice(start, end).trim());
      if (end >= t.length) break;
      start += Math.max(1, size - overlap);
    }
    return out.filter(Boolean);
  }

  if (paras.length > 1) {
    let buf = "";
    for (const p of paras) {
      const next = (buf ? buf + "\n\n" : "") + p;
      if (next.length > size) {
        if (buf) chunks.push(...splitWithOverlap(buf));
        buf = p;
      } else {
        buf = next;
      }
    }
    if (buf) chunks.push(...splitWithOverlap(buf));
  } else {
    chunks.push(...splitWithOverlap(text));
  }

  return chunks;
}

function parsePncpNcp(ncp: string): { cnpj: string; sequencial: string; ano: string } | null {
  if (!ncp) return null;
  const parts = ncp.match(/^(\d+)-\d+-(\d+)\/(\d+)$/);
  if (!parts) return null;
  return { cnpj: parts[1], sequencial: String(parseInt(parts[2], 10)), ano: parts[3] };
}

function extractTextFromOcr(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(extractTextFromOcr).join("\n");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.text && typeof obj.text === "string") return obj.text;
    if (obj.content && typeof obj.content === "string") return obj.content;
    if (obj.pages) return extractTextFromOcr(obj.pages);
    if (obj.results) return extractTextFromOcr(obj.results);
    return Object.values(obj).map(extractTextFromOcr).join("\n");
  }
  return "";
}

function truncateText(text: string, maxLen = MAX_OCR_TEXT): string {
  if (text.length <= maxLen) return text;
  const half = Math.floor(maxLen / 2);
  return text.slice(0, half) + "\n\n[... TEXTO TRUNCADO ...]\n\n" + text.slice(-half);
}

function parseNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    // Handle PT-BR format: 1.234.567,89
    const cleaned = val.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseBool(val: unknown): boolean | null {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    if (["true", "sim", "yes", "1"].includes(lower)) return true;
    if (["false", "não", "nao", "no", "0"].includes(lower)) return false;
  }
  return null;
}

function safeJson(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

async function trackLlmUsage(
  tenantId: string,
  workflow: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  licitacaoId?: string
) {
  const totalTokens = inputTokens + outputTokens;
  const costUsd = estimateCost(model, inputTokens, outputTokens);
  await query(
    `INSERT INTO llm_usage (tenant_id, workflow, model, licitacao_id, input_tokens, output_tokens, total_tokens, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [tenantId, workflow, model, licitacaoId || null, inputTokens, outputTokens, totalTokens, costUsd]
  );
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "qwen/qwen3-235b-a22b": { input: 0.3, output: 1.2 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] ||
    Object.entries(MODEL_COSTS).find(([k]) => model?.includes(k))?.[1] ||
    { input: 1, output: 4 };
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// --- Pipeline Steps ---

async function loadTenantContext(tenantId: string): Promise<TenantContext | null> {
  const row = await queryOne<{
    tenant_id: string;
    tenant_nome: string;
    segmento: string;
    config: Record<string, unknown>;
    palavras_inclusao: string[];
    palavras_exclusao: string[];
    prompt_pre_triagem: string | null;
    prompt_analise_completa: string | null;
    output_schema: string | null;
  }>(
    `SELECT
      t.id as tenant_id,
      t.nome as tenant_nome,
      COALESCE(t.segmento, '') as segmento,
      COALESCE(t.config, '{}'::jsonb) as config,
      array_agg(DISTINCT CASE WHEN pc.tipo = 'INCLUSAO' THEN pc.palavra END)
        FILTER (WHERE pc.tipo = 'INCLUSAO') as palavras_inclusao,
      array_agg(DISTINCT CASE WHEN pc.tipo = 'EXCLUSAO' THEN pc.palavra END)
        FILTER (WHERE pc.tipo = 'EXCLUSAO') as palavras_exclusao,
      (SELECT content FROM custom_prompts WHERE tenant_id = t.id
        AND prompt_type = 'PRE_TRIAGEM' AND is_active = true LIMIT 1) as prompt_pre_triagem,
      (SELECT content FROM custom_prompts WHERE tenant_id = t.id
        AND prompt_type = 'ANALISE_COMPLETA' AND is_active = true LIMIT 1) as prompt_analise_completa,
      (SELECT content FROM custom_prompts WHERE tenant_id = t.id
        AND prompt_type = 'OUTPUT_SCHEMA' AND is_active = true LIMIT 1) as output_schema
    FROM tenants t
    LEFT JOIN palavras_chave pc ON pc.tenant_id = t.id AND pc.ativa = TRUE
    WHERE t.id = $1
    GROUP BY t.id, t.nome, t.segmento, t.config`,
    [tenantId]
  );

  if (!row) return null;
  return {
    ...row,
    palavras_inclusao: (row.palavras_inclusao || []).filter(Boolean),
    palavras_exclusao: (row.palavras_exclusao || []).filter(Boolean),
  };
}

async function selectPendingLicitacoes(tenantId: string, maxLicitacoes = 20): Promise<PendingLicitacao[]> {
  return query<PendingLicitacao>(
    `SELECT
      l.id, l.numero_controle_pncp, l.cnpj_orgao, l.ano_compra, l.sequencial_compra,
      l.orgao_nome, l.objeto_compra, l.valor_total_estimado, l.modalidade_contratacao,
      l.tipo_participacao, l.uf, l.municipio, l.data_publicacao, l.data_encerramento_proposta,
      l.link_sistema_origem,
      CASE WHEN l.data_encerramento_proposta IS NULL THEN NULL
        ELSE EXTRACT(DAY FROM (l.data_encerramento_proposta - NOW()))
      END as dias_restantes
    FROM licitacoes l
    LEFT JOIN analises a ON a.licitacao_id = l.id
    WHERE l.tenant_id = $1
      AND l.passou_pre_triagem = TRUE
      AND l.status = 'NOVA'
      AND COALESCE(l.review_phase, 'NOVA') = 'NOVA'
      AND a.id IS NULL
      AND (l.data_encerramento_proposta IS NULL OR l.data_encerramento_proposta > NOW())
    ORDER BY l.data_encerramento_proposta ASC NULLS LAST, l.created_at DESC
    LIMIT $2`,
    [tenantId, maxLicitacoes]
  );
}

async function runPreTriagem(
  lic: PendingLicitacao,
  ctx: TenantContext
): Promise<PreTriagemResult> {
  const prompt = `${ctx.prompt_pre_triagem || ""}

## LICITACAO PARA AVALIAR
- Orgao: ${lic.orgao_nome}
- Objeto: ${lic.objeto_compra}
- Valor Estimado: R$ ${lic.valor_total_estimado?.toLocaleString("pt-BR") || "N/A"}
- Modalidade: ${lic.modalidade_contratacao}
- UF: ${lic.uf} - ${lic.municipio}

## EMPRESA
Nome: ${ctx.tenant_nome}
Segmento: ${ctx.segmento || "Geral"}

## PRODUTOS/SERVICOS DE INTERESSE (inclusao)
${ctx.palavras_inclusao.join(", ") || "Nao especificado"}

## PRODUTOS/SERVICOS DE EXCLUSAO
${ctx.palavras_exclusao.join(", ") || "Nenhum"}

## SUA TAREFA
Analise o objeto da licitacao e decida se PODE ter itens relevantes para esta empresa.

## CRITERIOS DE REJEICAO (responda REJEITAR)
- Produtos/servicos listados em EXCLUSAO
- Itens claramente fora do segmento da empresa
- Licitacoes de outro setor completamente diferente

## CRITERIOS PARA ANALISE (responda ANALISAR)
- Mencao a qualquer palavra de INCLUSAO
- Produtos/servicos similares aos oferecidos
- Licitacoes genericas que podem incluir itens relevantes

## FORMATO DE RESPOSTA
Responda APENAS com JSON valido:
{
  "decisao": "ANALISAR" ou "REJEITAR",
  "motivo": "Justificativa em 1 linha",
  "confianca": 0-100
}`;

  const result = await callLLM(PRE_TRIAGEM_MODEL, [
    { role: "system", content: "Voce e um classificador especializado em licitacoes publicas. Responda apenas com JSON valido." },
    { role: "user", content: prompt },
  ], 0.1, 256);

  await trackLlmUsage(ctx.tenant_id, "PRE_TRIAGEM", PRE_TRIAGEM_MODEL, result.usage.input_tokens, result.usage.output_tokens, lic.id);

  try {
    // Strip markdown fences if present
    const cleaned = result.content.replace(/```json?\s*\n?/g, "").replace(/```\s*$/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { decisao: "ANALISAR", motivo: "Erro ao parsear resposta, enviando para analise", confianca: 50 };
  }
}

async function fetchPncpFiles(ncp: string): Promise<{ url: string; titulo: string; tipo: string }[]> {
  const parsed = parsePncpNcp(ncp);
  if (!parsed) return [];

  const baseUrl = `https://pncp.gov.br/pncp-api/v1/orgaos/${parsed.cnpj}/compras/${parsed.ano}/${parsed.sequencial}/arquivos`;

  try {
    const res = await fetch(baseUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return [];

    const files = await res.json();
    if (!Array.isArray(files)) return [];

    return files
      .filter((f: { statusAtivo?: boolean }) => f.statusAtivo !== false)
      .map((f: { url?: string; titulo?: string; tipoDocumentoNome?: string; sequencialDocumento?: number }) => ({
        url: f.url || `${baseUrl}/${f.sequencialDocumento || 1}`,
        titulo: f.titulo || "Documento",
        tipo: f.tipoDocumentoNome || "Edital",
      }));
  } catch {
    return [];
  }
}

async function callOcrSupremo(documents: { url: string; id: string; nome: string; tipo: string }[]): Promise<string> {
  try {
    const res = await fetch(OCR_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
      signal: AbortSignal.timeout(300000), // 5 min for OCR
    });

    if (!res.ok) {
      return "";
    }

    const data = await res.json();
    const text = extractTextFromOcr(data);
    // Return FULL text — RAG handles context window, no truncation here
    return text
      .replace(/\u0000/g, "")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

async function buildRagContext(
  tenantId: string,
  licitacaoId: string,
  editalText: string,
  keywords: string[] = []
): Promise<string> {
  // 1. Create chunks (paragraph-aware)
  const chunks = chunkText(editalText);
  if (chunks.length === 0) return buildFallbackContext(editalText);

  // 2. Generate a project_id for this licitacao's RAG
  const projectId = licitacaoId;

  // 3. Delete old vectors for this licitacao
  await query(
    `DELETE FROM project_knowledge_base WHERE tenant_id = $1::uuid AND project_id = $2::uuid`,
    [tenantId, projectId]
  );

  // 4. Embed chunks in batches of 50 (API limits)
  const BATCH_SIZE = 50;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await getEmbeddings(batch);
    allEmbeddings.push(...embeddings);
  }

  // 5. Batch insert all chunks (single SQL with VALUES)
  const insertValues: string[] = [];
  const insertParams: unknown[] = [tenantId, projectId];
  let paramIdx = 3;

  for (let i = 0; i < chunks.length; i++) {
    const metaJson = JSON.stringify({
      chunk_index: i,
      total_chunks: chunks.length,
      source: "edital",
      licitacao_id: licitacaoId,
    });
    const vecStr = `[${allEmbeddings[i].join(",")}]`;
    insertValues.push(`($1::uuid, $2::uuid, $${paramIdx}, $${paramIdx + 1}::jsonb, $${paramIdx + 2}::vector)`);
    insertParams.push(chunks[i], metaJson, vecStr);
    paramIdx += 3;
  }

  // Insert in batches of 20 rows (avoid too many params)
  const ROW_BATCH = 20;
  for (let i = 0; i < insertValues.length; i += ROW_BATCH) {
    const batchValues = insertValues.slice(i, i + ROW_BATCH);
    // Rebuild params for this batch
    const batchParams: unknown[] = [tenantId, projectId];
    let bIdx = 3;
    for (let j = i; j < Math.min(i + ROW_BATCH, chunks.length); j++) {
      const metaJson = JSON.stringify({
        chunk_index: j,
        total_chunks: chunks.length,
        source: "edital",
        licitacao_id: licitacaoId,
      });
      const vecStr = `[${allEmbeddings[j].join(",")}]`;
      batchValues[j - i] = `($1::uuid, $2::uuid, $${bIdx}, $${bIdx + 1}::jsonb, $${bIdx + 2}::vector)`;
      batchParams.push(chunks[j], metaJson, vecStr);
      bIdx += 3;
    }
    await query(
      `INSERT INTO project_knowledge_base (tenant_id, project_id, content, metadata, embedding) VALUES ${batchValues.join(", ")}`,
      batchParams
    );
  }

  // Track embedding usage
  const totalChars = chunks.reduce((s, c) => s + c.length, 0);
  const approxTokens = Math.ceil(totalChars / 4);
  await trackLlmUsage(tenantId, "EMBEDDINGS", EMBEDDING_MODEL, approxTokens, 0, licitacaoId);

  // 6. HYBRID RETRIEVAL: semantic search + keyword matching
  // Semantic search alone misses item lists (numbers + product names have poor embedding similarity)
  const keywordStr = keywords.slice(0, 10).join(", ");
  const semanticQueries = [
    { name: "datas", text: "data e hora da sessão/disputa/abertura; recebimento de propostas; data limite; pregão eletrônico" },
    { name: "itens", text: `tabela de itens/lotes: item, descrição, quantidade, unidade, valor unitário, valor total; ${keywordStr || "papel, resma, A4, bobina"}; cota reservada` },
    { name: "prazos", text: "prazos: entrega, pagamento, vigência do contrato/ata, validade da proposta, impugnação, esclarecimentos" },
    { name: "amostra", text: "exigência de amostra: apresentação/entrega de amostra, protótipo, amostra física; prazo e local" },
    { name: "me_epp", text: "ME/EPP por item: exclusivo ME/EPP, cota reservada, cota principal, LC 123, microempresa" },
  ];

  // 7. Embed queries
  const queryTexts = semanticQueries.map(q => q.text);
  const queryEmbeddings = await getEmbeddings(queryTexts);
  await trackLlmUsage(tenantId, "EMBEDDINGS", EMBEDDING_MODEL, Math.ceil(queryTexts.join(" ").length / 4), 0, licitacaoId);

  // 8. Global ranking SQL (DISTINCT per chunk, global TOP K)
  const qValues = semanticQueries.map((q, i) => {
    const vec = `[${queryEmbeddings[i].join(",")}]`;
    return `('${q.name}', '${vec}'::vector)`;
  }).join(", ");

  const ragResults = await query<{ query_name: string; content: string; similarity: number }>(
    `WITH q(name, embedding) AS (VALUES ${qValues}),
     scored AS (
       SELECT kb.id, kb.content, q.name as query_name,
              (kb.embedding <=> q.embedding) as distance,
              row_number() OVER (PARTITION BY kb.id ORDER BY (kb.embedding <=> q.embedding)) as rn_best
       FROM q
       JOIN project_knowledge_base kb
         ON kb.tenant_id = $1::uuid AND kb.project_id = $2::uuid
        AND kb.embedding IS NOT NULL
     ),
     best AS (
       SELECT id, content, query_name, distance
       FROM scored WHERE rn_best = 1
     ),
     ranked AS (
       SELECT query_name, content, (1 - distance) as similarity,
              row_number() OVER (ORDER BY distance) as rn
       FROM best
     )
     SELECT query_name, content, similarity
     FROM ranked WHERE rn <= $3
     ORDER BY rn`,
    [tenantId, projectId, RAG_TOP_K]
  );

  // 9. KEYWORD MATCHING: find chunks containing tenant product keywords
  // This catches item lists that embeddings miss (product names + numbers ≠ natural language)
  const semanticContentSet = new Set(ragResults.map(r => r.content.slice(0, 100)));
  const keywordChunks: { query_name: string; content: string; similarity: number }[] = [];

  if (keywords.length > 0) {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    for (const chunk of chunks) {
      // Skip chunks already in semantic results
      if (semanticContentSet.has(chunk.slice(0, 100))) continue;

      const lowerChunk = chunk.toLowerCase();
      // Count keyword matches + check for price/quantity patterns (item table markers)
      const kwMatches = lowerKeywords.filter(kw => lowerChunk.includes(kw)).length;
      const hasNumbers = /\d+[.,]\d{2}/.test(chunk); // price pattern (e.g., 78.900,00)
      const hasItemPattern = /\b(unidade|pacote|caixa|resma|fls|folha|SIM|NÃO|rolo|bobina|metro)\b/i.test(chunk);

      // Match if: 2+ keywords, OR 1 keyword + looks like an item table
      if (kwMatches >= 2 || (kwMatches >= 1 && hasNumbers && hasItemPattern)) {
        keywordChunks.push({
          query_name: "itens_keyword",
          content: chunk,
          similarity: kwMatches * 0.1, // synthetic score for sorting
        });
      }
    }
    // Sort by keyword match count (descending), take up to 10 chunks
    // Item lists often span many pages — need enough chunks to capture all items
    keywordChunks.sort((a, b) => b.similarity - a.similarity);
    keywordChunks.splice(10);
  }

  // 10. Merge semantic + keyword results
  const allResults = [...ragResults, ...keywordChunks];

  if (allResults.length === 0) {
    return buildFallbackContext(editalText);
  }

  // Group by category for readable output
  const order = ["datas", "itens", "itens_keyword", "prazos", "amostra", "me_epp"];
  const grouped = new Map<string, typeof allResults>();
  for (const r of allResults) {
    const list = grouped.get(r.query_name) || [];
    list.push(r);
    grouped.set(r.query_name, list);
  }

  let context = `LICITACAO_ID: ${licitacaoId}\nREGRAS: use SOMENTE os trechos abaixo para preencher o JSON. Se não achar, use null/0/[].\n---\n`;
  for (const name of order) {
    const list = grouped.get(name);
    if (!list || list.length === 0) continue;
    const label = name === "itens_keyword" ? "ITENS (PRODUTOS)" : name.toUpperCase();
    context += `\n## ${label}\n`;
    for (const r of list) {
      context += `${r.content.trim()}\n---\n`;
    }
  }
  return context;
}

function buildFallbackContext(editalText: string): string {
  // Fallback: send first 30K of raw OCR (matches N8N behavior)
  if (!editalText || editalText.length < 100) return "";
  return `[RAG] Nenhum trecho recuperado. Texto bruto do edital:\n\n${editalText.slice(0, 30000)}`;
}

interface FullAnalysisResult {
  data: Record<string, unknown>;
  raw: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  time_ms: number;
}

async function runFullAnalysis(
  lic: PendingLicitacao,
  ctx: TenantContext,
  ragContext: string
): Promise<FullAnalysisResult> {
  const focoUf = (ctx.config as Record<string, unknown>)?.foco_uf || lic.uf || "";
  const regra80k = (ctx.config as Record<string, unknown>)?.regra_80k;

  const defaultSchema = `{
  "resumo": {
    "objeto_resumido": "string",
    "data_realizacao_certame": "YYYY-MM-DD HH:MM ou null",
    "numero_pregao_extraido": "string ou null",
    "total_itens": 0,
    "itens_relevantes_count": 0,
    "valor_total_licitacao": 0,
    "valor_itens_relevantes": 0,
    "percentual_relevante": 0
  },
  "analise": {
    "prioridade": "P1|P2|P3|REJEITAR",
    "justificativa": "string detalhada",
    "pontos_positivos": ["string"],
    "pontos_atencao": ["string"],
    "recomendacao": "string",
    "amostra_exigida": true/false/null,
    "amostra_evidencia": "trecho do edital ou null"
  },
  "itens": [
    {
      "numero": 1,
      "descricao": "string",
      "quantidade": 0,
      "unidade": "string",
      "valor_unitario": 0,
      "valor_total": 0,
      "e_produto_relevante": true/false,
      "tipo_produto": "string ou null",
      "confianca": 0-100,
      "evidencia": "trecho do edital"
    }
  ],
  "documentos_necessarios": ["string"],
  "prazos_importantes": {
    "data_abertura_propostas": "YYYY-MM-DD HH:MM ou null",
    "data_realizacao_certame": "YYYY-MM-DD HH:MM ou null",
    "prazo_entrega_dias": 0,
    "prazo_pagamento_dias": 0,
    "prazo_vigencia_meses": 0,
    "validade_proposta_dias": 0,
    "data_limite_envio_propostas": "YYYY-MM-DD HH:MM ou null"
  },
  "requisitos_tecnicos": ["string"],
  "analise_riscos": {
    "nivel_risco": "BAIXO|MEDIO|ALTO",
    "fatores": ["string"]
  },
  "preferencias_me_epp": {
    "exclusivo_me_epp": true/false/null,
    "margem_preferencia_percentual": 0,
    "limite_valor_exclusivo": 0,
    "observacoes": "string"
  },
  "garantias": {
    "garantia_proposta_percentual": 0,
    "garantia_contratual_percentual": 0,
    "tipo_garantia_aceita": ["string"],
    "valor_estimado_garantia": 0
  },
  "forma_fornecimento": {
    "tipo": "INTEGRAL|PARCELADO|DEMANDA",
    "locais_entrega": ["string"],
    "frete": "CIF|FOB|null"
  }
}`;

  const prompt = `## CONTEXTO DA EMPRESA
Nome: ${ctx.tenant_nome}
Segmento: ${ctx.segmento || "Geral"}
Foco Geografico: ${focoUf}
${regra80k ? "Regra 80k: Nao participar de ME/EPP > R$80.000" : ""}

## SERVICOS/PRODUTOS QUE A EMPRESA FORNECE
${ctx.palavras_inclusao.join(", ") || "Nao especificado"}

## SERVICOS/PRODUTOS QUE A EMPRESA NAO FORNECE
${ctx.palavras_exclusao.join(", ") || "Nenhum"}

## DADOS DA LICITACAO
Objeto: ${lic.objeto_compra}
Orgao: ${lic.orgao_nome}
UF: ${lic.uf} - ${lic.municipio}
Valor Estimado (PNCP): R$ ${lic.valor_total_estimado?.toLocaleString("pt-BR") || "N/A"}
Modalidade: ${lic.modalidade_contratacao}
Tipo: ${lic.tipo_participacao}
Urgencia: ${lic.dias_restantes != null ? lic.dias_restantes + " dias restantes" : "Sem prazo definido"}

## CONTEXTO DO EDITAL (RAG - SOMENTE ESTA LICITACAO)
${ragContext || "Nenhum documento disponivel. Analise baseada apenas no objeto da compra."}

${ctx.prompt_analise_completa || ""}

## REGRAS OBRIGATORIAS
1. Extraia APENAS informacoes presentes no TEXTO DO EDITAL acima
2. Se um dado nao estiver explicito, retorne null/0/[]
3. NAO invente informacoes
4. Para cada item, cite a evidencia do texto
5. EXTRAIA TODOS os itens que sejam produtos/servicos do segmento da empresa, independente do valor unitario
6. Inclua itens de qualquer valor, desde que sejam relevantes para a empresa (papel, envelope, pasta, impressos, etc.)
7. Para prioridade, use APENAS: "P1" (alta), "P2" (media), "P3" (baixa), ou "REJEITAR"
8. Para cada item use EXATAMENTE estes campos: numero (inteiro), descricao, quantidade, unidade, valor_unitario, valor_total, e_produto_grafico (true/false), tipo_produto, confianca (0-100), evidencia

## FORMATO DE SAIDA JSON
Responda EXATAMENTE neste formato JSON. Inclua todos os campos, mesmo com null/0/[].
${ctx.output_schema || defaultSchema}`;

  const startMs = Date.now();
  const result = await callLLM(ANALYSIS_MODEL, [
    { role: "system", content: "Voce e um Analista de Licitacoes Senior especializado em EXTRACAO de dados de editais. Responda apenas com JSON valido." },
    { role: "user", content: prompt },
  ], 0.15, 16384);
  const elapsedMs = Date.now() - startMs;

  await trackLlmUsage(ctx.tenant_id, "ANALISE_COMPLETA", ANALYSIS_MODEL, result.usage.input_tokens, result.usage.output_tokens, lic.id);

  const rawContent = result.content;
  try {
    const cleaned = rawContent.replace(/```json?\s*\n?/g, "").replace(/```\s*$/g, "").trim();
    return {
      data: JSON.parse(cleaned),
      raw: cleaned,
      model: ANALYSIS_MODEL,
      tokens_in: result.usage.input_tokens,
      tokens_out: result.usage.output_tokens,
      time_ms: elapsedMs,
    };
  } catch {
    return {
      data: { analise: { prioridade: "P3", justificativa: "Erro ao parsear resposta da IA" }, itens: [] },
      raw: rawContent,
      model: ANALYSIS_MODEL,
      tokens_in: result.usage.input_tokens,
      tokens_out: result.usage.output_tokens,
      time_ms: elapsedMs,
    };
  }
}

function normalizeAnalysis(raw: Record<string, unknown>): {
  prioridade: string;
  justificativa: string;
  score_relevancia: number;
  tipo_oportunidade: string;
  valor_itens_relevantes: number;
  amostra_exigida: boolean | null;
  amostra_evidencia: string | null;
  documentos_necessarios: string | null;
  prazos: string | null;
  requisitos_tecnicos: string | null;
  analise_riscos: string | null;
  preferencias_me_epp: string | null;
  garantias: string | null;
  forma_fornecimento: string | null;
  campos_customizados: string | null;
  itens: {
    numero_item: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    valor_total: number;
    e_produto_grafico: boolean;
    tipo_produto: string | null;
    confianca_classificacao: number;
    item_exclusivo_me_epp: boolean;
    evidencia: string | null;
  }[];
} {
  const analise = (raw.analise || {}) as Record<string, unknown>;
  const resumo = (raw.resumo || {}) as Record<string, unknown>;
  const itensRaw = (raw.itens || []) as Record<string, unknown>[];

  // Normalize prioridade — LLM sometimes returns a sentence instead of P1/P2/P3
  let prioridade = String(analise.prioridade || "P3").trim();
  if (!["P1", "P2", "P3", "REJEITAR"].includes(prioridade)) {
    const lower = prioridade.toLowerCase();
    if (lower.includes("alta") || lower.includes("p1")) prioridade = "P1";
    else if (lower.includes("media") || lower.includes("média") || lower.includes("p2")) prioridade = "P2";
    else if (lower.includes("baixa") || lower.includes("p3")) prioridade = "P3";
    else if (lower.includes("rejeit")) prioridade = "REJEITAR";
    else prioridade = "P3";
  }
  const justificativa = (analise.justificativa as string) || (analise.recomendacao as string) || "";

  // Score: map priority to score
  const scoreMap: Record<string, number> = { P1: 90, P2: 70, P3: 40, REJEITAR: 10 };
  const score = scoreMap[prioridade] || 50;

  // Tipo oportunidade
  let tipo = "AVALIAR";
  if (prioridade === "REJEITAR") tipo = "PRE_TRIAGEM_REJEITAR";
  else if (prioridade === "P1") tipo = "PARTICIPAR";

  // Valor itens relevantes
  const valorRelevantes = parseNumber(resumo.valor_itens_relevantes);

  // Items normalization (matches N8N "Processar Resposta IA")
  const itens = itensRaw.map((item, idx) => {
    const quantidade = parseNumber(item.quantidade);
    const valor_unitario = parseNumber(item.valor_unitario);
    let valor_total = parseNumber(item.valor_total);
    // Recalculate valor_total if missing (like N8N does)
    if ((!valor_total || valor_total === 0) && quantidade && valor_unitario) {
      valor_total = quantidade * valor_unitario;
    }
    // Handle multiple field name variations for the boolean classification
    const e_produto_grafico =
      parseBool(item.e_produto_grafico) ??
      parseBool(item.e_produto_relevante) ??
      parseBool(item.existe) ??
      parseBool(item.relevante) ??
      false;
    // confianca as 0.00-1.00 (N8N divides by 100)
    const rawConf = parseNumber(item.confianca) || parseNumber(item.confianca_classificacao);
    const confianca = rawConf > 1 ? Math.round((rawConf / 100) * 100) / 100 : Math.round(rawConf * 100) / 100;

    // Handle item number from multiple fields
    const itemNum = parseNumber(item.numero) || parseNumber(item.id) || parseNumber(item.item) || parseNumber(item.numero_item);

    return {
      numero_item: itemNum || idx + 1,
      descricao: String(item.descricao || ""),
      quantidade,
      unidade: String(item.unidade || "UN"),
      valor_unitario,
      valor_total: valor_total || 0,
      e_produto_grafico,
      tipo_produto: item.tipo_produto ? String(item.tipo_produto) : "outro",
      confianca_classificacao: confianca,
      item_exclusivo_me_epp: parseBool(item.item_exclusivo_me_epp) ?? false,
      evidencia: item.evidencia ? String(item.evidencia).slice(0, 400) : null,
    };
  });

  // Recalculate valor_itens_relevantes from items (N8N does this, not from LLM summary)
  const valorRelevantesCalc = itens
    .filter(i => i.e_produto_grafico)
    .reduce((acc, i) => acc + (i.valor_total || 0), 0);

  // Extract custom fields (anything not in standard schema)
  const standardKeys = new Set(["analise", "resumo", "itens", "documentos_necessarios", "prazos_importantes", "requisitos_tecnicos", "analise_riscos", "preferencias_me_epp", "garantias", "forma_fornecimento"]);
  const customFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!standardKeys.has(k) && v !== null && v !== undefined) {
      customFields[k] = v;
    }
  }

  return {
    prioridade,
    justificativa,
    score_relevancia: score,
    tipo_oportunidade: tipo,
    valor_itens_relevantes: valorRelevantesCalc || parseNumber(resumo.valor_itens_relevantes),
    amostra_exigida: parseBool(analise.amostra_exigida),
    amostra_evidencia: analise.amostra_evidencia ? String(analise.amostra_evidencia) : null,
    documentos_necessarios: safeJson(raw.documentos_necessarios),
    prazos: safeJson(raw.prazos_importantes),
    requisitos_tecnicos: safeJson(raw.requisitos_tecnicos),
    analise_riscos: safeJson(raw.analise_riscos),
    preferencias_me_epp: safeJson(raw.preferencias_me_epp),
    garantias: safeJson(raw.garantias),
    forma_fornecimento: safeJson(raw.forma_fornecimento),
    campos_customizados: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
    itens,
  };
}

async function saveAnalysis(
  licitacaoId: string,
  executionId: string | undefined,
  normalized: ReturnType<typeof normalizeAnalysis>,
  meta?: { raw: string; model: string; tokens_in: number; tokens_out: number; time_ms: number }
) {
  // Upsert analise
  await query(
    `INSERT INTO analises (
      licitacao_id, execution_id, prioridade, tipo_oportunidade, score_relevancia,
      justificativa, valor_itens_relevantes, amostra_exigida, amostra_evidencia,
      documentos_necessarios, prazos, requisitos_tecnicos, analise_riscos,
      preferencias_me_epp, garantias, forma_fornecimento, campos_customizados,
      raw_response, modelo_ia, tokens_entrada, tokens_saida, tempo_analise_ms
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    ON CONFLICT (licitacao_id) DO UPDATE SET
      execution_id = EXCLUDED.execution_id,
      prioridade = EXCLUDED.prioridade,
      tipo_oportunidade = EXCLUDED.tipo_oportunidade,
      score_relevancia = EXCLUDED.score_relevancia,
      justificativa = EXCLUDED.justificativa,
      valor_itens_relevantes = EXCLUDED.valor_itens_relevantes,
      amostra_exigida = EXCLUDED.amostra_exigida,
      amostra_evidencia = EXCLUDED.amostra_evidencia,
      documentos_necessarios = EXCLUDED.documentos_necessarios,
      prazos = EXCLUDED.prazos,
      requisitos_tecnicos = EXCLUDED.requisitos_tecnicos,
      analise_riscos = EXCLUDED.analise_riscos,
      preferencias_me_epp = EXCLUDED.preferencias_me_epp,
      garantias = EXCLUDED.garantias,
      forma_fornecimento = EXCLUDED.forma_fornecimento,
      campos_customizados = EXCLUDED.campos_customizados,
      raw_response = EXCLUDED.raw_response,
      modelo_ia = EXCLUDED.modelo_ia,
      tokens_entrada = EXCLUDED.tokens_entrada,
      tokens_saida = EXCLUDED.tokens_saida,
      tempo_analise_ms = EXCLUDED.tempo_analise_ms`,
    [
      licitacaoId,
      executionId || null,
      normalized.prioridade,
      normalized.tipo_oportunidade,
      normalized.score_relevancia,
      normalized.justificativa,
      normalized.valor_itens_relevantes,
      normalized.amostra_exigida,
      normalized.amostra_evidencia,
      normalized.documentos_necessarios,
      normalized.prazos,
      normalized.requisitos_tecnicos,
      normalized.analise_riscos,
      normalized.preferencias_me_epp,
      normalized.garantias,
      normalized.forma_fornecimento,
      normalized.campos_customizados,
      meta?.raw || null,
      meta?.model || null,
      meta?.tokens_in || null,
      meta?.tokens_out || null,
      meta?.time_ms || null,
    ]
  );

  // Upsert items
  for (const item of normalized.itens) {
    await query(
      `INSERT INTO itens_licitacao (
        licitacao_id, numero_item, descricao, quantidade, unidade,
        valor_unitario, valor_total, e_produto_grafico, tipo_produto,
        confianca_classificacao, item_exclusivo_me_epp, evidencia
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (licitacao_id, numero_item) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        quantidade = EXCLUDED.quantidade,
        unidade = EXCLUDED.unidade,
        valor_unitario = EXCLUDED.valor_unitario,
        valor_total = EXCLUDED.valor_total,
        e_produto_grafico = EXCLUDED.e_produto_grafico,
        tipo_produto = EXCLUDED.tipo_produto,
        confianca_classificacao = EXCLUDED.confianca_classificacao,
        item_exclusivo_me_epp = EXCLUDED.item_exclusivo_me_epp,
        evidencia = EXCLUDED.evidencia`,
      [
        licitacaoId,
        item.numero_item,
        item.descricao,
        item.quantidade,
        item.unidade,
        item.valor_unitario,
        item.valor_total,
        item.e_produto_grafico,
        item.tipo_produto,
        item.confianca_classificacao,
        item.item_exclusivo_me_epp,
        item.evidencia,
      ]
    );
  }

  // Update licitacao status
  await query(
    `UPDATE licitacoes SET status = 'ANALISADA', review_phase = 'analyzed', updated_at = NOW() WHERE id = $1`,
    [licitacaoId]
  );
}

async function saveRejection(
  licitacaoId: string,
  executionId: string | undefined,
  motivo: string
) {
  await query(
    `INSERT INTO analises (licitacao_id, execution_id, prioridade, tipo_oportunidade, score_relevancia, justificativa)
     VALUES ($1, $2, 'P3', 'PRE_TRIAGEM_REJEITAR', 10, $3)
     ON CONFLICT (licitacao_id) DO UPDATE SET
       prioridade = 'P3',
       tipo_oportunidade = 'PRE_TRIAGEM_REJEITAR',
       score_relevancia = 10,
       justificativa = EXCLUDED.justificativa`,
    [licitacaoId, executionId || null, motivo]
  );

  await query(
    `UPDATE licitacoes SET status = 'ANALISADA', review_phase = 'REJEITADA', updated_at = NOW() WHERE id = $1`,
    [licitacaoId]
  );
}

// --- Main Entry Point ---

export async function executarAnalise(
  tenantId: string,
  executionId?: string,
  onProgress?: (msg: string) => Promise<void>,
  maxLicitacoes = 20
): Promise<AnaliseResult> {
  const stats: AnaliseStats = {
    total_pendentes: 0,
    pre_triagem_aprovadas: 0,
    pre_triagem_rejeitadas: 0,
    analisadas: 0,
    erros_ocr: 0,
    erros_analise: 0,
    sem_edital: 0,
  };

  try {
    // 1. Load tenant context
    const ctx = await loadTenantContext(tenantId);
    if (!ctx) {
      return { success: false, stats, error: "Tenant nao encontrado" };
    }

    await onProgress?.(`Contexto carregado: ${ctx.tenant_nome} | ${ctx.palavras_inclusao.length} keywords`);

    // 2. Select pending licitações
    const pendentes = await selectPendingLicitacoes(tenantId, maxLicitacoes);
    stats.total_pendentes = pendentes.length;

    if (pendentes.length === 0) {
      return { success: true, stats, error: "Nenhuma licitacao pendente para analise" };
    }

    await onProgress?.(`${pendentes.length} licitacoes pendentes para analise`);

    // 3. Pre-triagem loop
    const aprovadas: PendingLicitacao[] = [];

    for (const lic of pendentes) {
      try {
        await onProgress?.(`Pre-triagem: ${lic.objeto_compra.slice(0, 80)}...`);
        const triagem = await runPreTriagem(lic, ctx);

        if (triagem.decisao === "ANALISAR") {
          aprovadas.push(lic);
          stats.pre_triagem_aprovadas++;
        } else {
          await saveRejection(lic.id, executionId, triagem.motivo);
          stats.pre_triagem_rejeitadas++;
        }
      } catch (err) {
        // On pre-triagem error, send to full analysis anyway
        aprovadas.push(lic);
        stats.pre_triagem_aprovadas++;
        const msg = err instanceof Error ? err.message : "Unknown";
        await onProgress?.(`Erro pre-triagem (enviando para analise): ${msg}`);
      }

      // Rate limit between pre-triagem calls
      await new Promise((r) => setTimeout(r, 300));
    }

    await onProgress?.(`Pre-triagem: ${stats.pre_triagem_aprovadas} aprovadas, ${stats.pre_triagem_rejeitadas} rejeitadas`);

    // 4. Full analysis loop
    for (let i = 0; i < aprovadas.length; i++) {
      const lic = aprovadas[i];
      try {
        await onProgress?.(`[${i + 1}/${aprovadas.length}] Analisando: ${lic.objeto_compra.slice(0, 60)}...`);

        // 4a. Fetch PNCP files
        const files = await fetchPncpFiles(lic.numero_controle_pncp);

        let ragContext = "";

        if (files.length > 0) {
          // 4b. OCR
          await onProgress?.(`[${i + 1}/${aprovadas.length}] OCR de ${files.length} documento(s)...`);
          const ocrDocs = files.slice(0, 5).map((f, idx) => ({
            url: f.url,
            id: `${lic.id}_doc${idx + 1}`,
            nome: f.titulo,
            tipo: f.tipo,
          }));

          const editalText = await callOcrSupremo(ocrDocs);

          if (editalText.length > 100) {
            // Store OCR text in editais table (like N8N "Gravar Edital")
            await query(
              `INSERT INTO editais (licitacao_id, arquivo_url, arquivo_nome, conteudo_texto, ocr_sucesso, ocr_metodo, tamanho_bytes)
               VALUES ($1, $2, $3, $4, true, 'OCR_SUPREMO', $5)
               ON CONFLICT (licitacao_id) DO UPDATE SET
                 conteudo_texto = EXCLUDED.conteudo_texto, ocr_sucesso = true,
                 tamanho_bytes = EXCLUDED.tamanho_bytes, updated_at = NOW()`,
              [lic.id, ocrDocs[0]?.url || "", ocrDocs[0]?.nome || "edital.pdf", editalText, editalText.length]
            );

            // 4c. Build context for LLM
            // GPT-4.1-mini has 1M token context → 500K chars (~125K tokens) fits easily
            // Only use RAG for very large documents where full text exceeds model capacity
            const RAG_THRESHOLD = 500000; // 500K chars (~125K tokens)
            if (editalText.length <= RAG_THRESHOLD) {
              // Send full OCR text — no need for RAG with large context models
              await onProgress?.(`[${i + 1}/${aprovadas.length}] Texto completo: ${Math.ceil(editalText.length / 1000)}K chars direto para LLM`);
              ragContext = `TEXTO COMPLETO DO EDITAL:\n\n${editalText}`;
            } else {
              // Very large document — use RAG hybrid (semantic + keyword)
              await onProgress?.(`[${i + 1}/${aprovadas.length}] RAG: ${Math.ceil(editalText.length / 1000)}K chars → chunks + embeddings...`);
              ragContext = await buildRagContext(tenantId, lic.id, editalText, ctx.palavras_inclusao);
            }
          } else {
            stats.erros_ocr++;
            await onProgress?.(`[${i + 1}/${aprovadas.length}] OCR insuficiente (${editalText.length} chars), analisando sem edital`);
          }
        } else {
          stats.sem_edital++;
          await onProgress?.(`[${i + 1}/${aprovadas.length}] Sem documentos no PNCP, analisando apenas pelo objeto`);
        }

        // 4d. Full AI analysis
        await onProgress?.(`[${i + 1}/${aprovadas.length}] IA Analise Completa...`);
        const analysisResult = await runFullAnalysis(lic, ctx, ragContext);

        // 4e. Normalize
        const normalized = normalizeAnalysis(analysisResult.data);

        // 4f. Save
        await saveAnalysis(lic.id, executionId, normalized, {
          raw: analysisResult.raw,
          model: analysisResult.model,
          tokens_in: analysisResult.tokens_in,
          tokens_out: analysisResult.tokens_out,
          time_ms: analysisResult.time_ms,
        });
        stats.analisadas++;

        await onProgress?.(`[${i + 1}/${aprovadas.length}] ${normalized.prioridade} | ${normalized.itens.length} itens | ${analysisResult.tokens_in}+${analysisResult.tokens_out} tokens | ${(analysisResult.time_ms / 1000).toFixed(1)}s`);

        // Rate limit between analyses
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        stats.erros_analise++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        const stack = err instanceof Error ? err.stack?.slice(0, 300) : "";
        await onProgress?.(`[${i + 1}/${aprovadas.length}] ERRO: ${msg.slice(0, 100)}`);
        // Log error details to workflow execution
        if (executionId) {
          await query(
            `UPDATE workflow_executions SET
              logs = COALESCE(logs, '[]'::jsonb) || $2::jsonb
            WHERE id = $1`,
            [executionId, JSON.stringify([{ time: new Date().toISOString(), message: `ERRO analise ${lic.id}: ${msg}\n${stack}`, level: "error" }])]
          ).catch(() => {});
        }
      }
    }

    // 5. Update execution record
    if (executionId) {
      await query(
        `UPDATE workflow_executions SET
          status = 'SUCCESS', finished_at = NOW(), progress = 100,
          current_step = 'Analise concluida',
          metrics = $2::jsonb,
          logs = COALESCE(logs, '[]'::jsonb) || $3::jsonb
        WHERE id = $1`,
        [
          executionId,
          JSON.stringify(stats),
          JSON.stringify([{
            time: new Date().toISOString(),
            message: `Analise: ${stats.analisadas} concluidas, ${stats.pre_triagem_rejeitadas} rejeitadas na pre-triagem`,
            level: "info",
          }]),
        ]
      );
    }

    return { success: true, stats };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";

    if (executionId) {
      await query(
        `UPDATE workflow_executions SET status = 'ERROR', finished_at = NOW(),
          current_step = $2,
          logs = COALESCE(logs, '[]'::jsonb) || $3::jsonb
        WHERE id = $1`,
        [
          executionId,
          `Erro: ${msg.slice(0, 200)}`,
          JSON.stringify([{ time: new Date().toISOString(), message: msg, level: "error" }]),
        ]
      );
    }

    return { success: false, stats, error: msg };
  }
}

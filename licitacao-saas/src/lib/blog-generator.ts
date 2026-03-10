import { query, queryOne } from "@/lib/db";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCGUuQIUL3M7bl8N6Aq82CriDVuKdLCrII";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export type BlogPostType =
  | "resumo_semanal"
  | "top_valor"
  | "segmento"
  | "ranking_cidades"
  | "guia";

interface GeneratedPost {
  title: string;
  slug: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  read_time_minutes: number;
}

const QUERIES: Record<string, string> = {
  resumo_semanal: `SELECT uf, COUNT(*) as total, SUM(valor_total_estimado) as valor,
    COUNT(DISTINCT municipio) as cidades, COUNT(DISTINCT modalidade_contratacao) as mods
    FROM licitacoes WHERE data_publicacao >= NOW() - INTERVAL '7 days'
    GROUP BY uf ORDER BY total DESC LIMIT 10`,

  top_valor: `SELECT orgao_nome, objeto_compra, valor_total_estimado, uf, modalidade_contratacao,
    data_encerramento_proposta
    FROM licitacoes WHERE data_encerramento_proposta > NOW() AND valor_total_estimado > 0
    ORDER BY valor_total_estimado DESC LIMIT 10`,

  segmento: `SELECT
    CASE
      WHEN objeto_compra ILIKE '%tecnologia%' OR objeto_compra ILIKE '%software%' OR objeto_compra ILIKE '%sistema%' THEN 'Tecnologia'
      WHEN objeto_compra ILIKE '%saúde%' OR objeto_compra ILIKE '%hospitalar%' OR objeto_compra ILIKE '%medicamento%' THEN 'Saúde'
      WHEN objeto_compra ILIKE '%construção%' OR objeto_compra ILIKE '%obra%' OR objeto_compra ILIKE '%engenharia%' THEN 'Construção'
      WHEN objeto_compra ILIKE '%alimento%' OR objeto_compra ILIKE '%merenda%' OR objeto_compra ILIKE '%alimentação%' THEN 'Alimentação'
      WHEN objeto_compra ILIKE '%veículo%' OR objeto_compra ILIKE '%transporte%' OR objeto_compra ILIKE '%combustível%' THEN 'Transporte'
      ELSE 'Outros'
    END as segmento,
    COUNT(*) as total, SUM(valor_total_estimado) as valor
    FROM licitacoes WHERE data_publicacao >= NOW() - INTERVAL '30 days'
    GROUP BY segmento ORDER BY total DESC`,

  ranking_cidades: `SELECT municipio, uf, COUNT(*) as total, SUM(valor_total_estimado) as valor
    FROM licitacoes WHERE data_publicacao >= NOW() - INTERVAL '30 days' AND municipio IS NOT NULL
    GROUP BY municipio, uf ORDER BY total DESC LIMIT 15`,
};

const GUIA_TOPICS = [
  {
    topic: "Como participar de Pregão Eletrônico: guia completo 2026",
    keywords: "pregão eletrônico, como participar, passo a passo",
  },
  {
    topic: "Dispensa de Licitação: quando e como se aplica",
    keywords: "dispensa, licitação, limite, hipóteses",
  },
  {
    topic: "5 erros que eliminam sua proposta de licitação",
    keywords: "proposta, erros, habilitação, documentação",
  },
  {
    topic: "ME/EPP: como aproveitar benefícios em licitações",
    keywords: "microempresa, pequena empresa, benefícios, preferência",
  },
  {
    topic: "Concorrência Eletrônica: o que muda na Nova Lei de Licitações",
    keywords: "concorrência, nova lei, 14133, mudanças",
  },
];

function buildPrompt(type: BlogPostType, data: unknown): string {
  const tipoLabel: Record<BlogPostType, string> = {
    resumo_semanal: "Resumo Semanal de Licitações",
    top_valor: "Top Oportunidades por Valor",
    segmento: "Análise por Segmento de Mercado",
    ranking_cidades: "Ranking de Cidades com Mais Licitações",
    guia: "Guia Educacional sobre Licitações",
  };

  return `Você é um especialista em licitações públicas no Brasil escrevendo para o blog do LicitaIA.

TIPO DE POST: ${tipoLabel[type]}
DADOS REAIS DO BANCO (use esses números no artigo):
${JSON.stringify(data, null, 2)}

REGRAS:
- Título chamativo com número ou dado real (ex: "450 licitações abertas em SP esta semana")
- 800-1500 palavras em markdown
- Subtítulos H2 com keywords relevantes para SEO
- Usar os dados reais (valores em R$, quantidades, estados, cidades)
- Incluir pelo menos 3 links internos para páginas do LicitaIA:
  - /editais/{uf} para estados mencionados (use a sigla em minúsculo)
  - /editais?q={keyword} para buscas relevantes
  - /precos para menção de planos
- CTA no final: "Cadastre-se grátis no LicitaIA e receba alertas personalizados"
- Tom: profissional, informativo, acessível
- Português correto com acentuação (ç, ã, é, ô, etc.)

Retorne APENAS JSON válido (sem markdown wrapping, sem \`\`\`json):
{
  "title": "...",
  "slug": "...-marco-2026",
  "description": "...(max 160 chars)",
  "content": "...(markdown completo)",
  "category": "${type === "guia" ? "guia" : type === "resumo_semanal" ? "resumo" : type === "top_valor" ? "mercado" : type === "segmento" ? "analise" : "mercado"}",
  "tags": ["licitação", "pregão", ...],
  "seo_title": "...(max 60 chars)",
  "seo_description": "...(max 160 chars)",
  "read_time_minutes": N
}`;
}

async function callGemini(prompt: string): Promise<GeneratedPost> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");

  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function generateBlogPost(type: BlogPostType): Promise<{
  id: string;
  slug: string;
  title: string;
}> {
  let data: unknown;
  let sourceQuery: string | null = null;

  if (type === "guia") {
    const topic = GUIA_TOPICS[Math.floor(Math.random() * GUIA_TOPICS.length)];
    data = topic;
  } else {
    sourceQuery = QUERIES[type];
    const rows = await query(sourceQuery);
    data = rows;
  }

  const prompt = buildPrompt(type, data);
  const post = await callGemini(prompt);

  // Ensure unique slug
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM blog_posts WHERE slug = $1",
    [post.slug]
  );
  if (existing) {
    post.slug = `${post.slug}-${Date.now().toString(36)}`;
  }

  const result = await queryOne<{ id: string; slug: string; title: string }>(
    `INSERT INTO blog_posts (slug, title, description, content, category, tags, seo_title, seo_description, read_time_minutes, generated_by, source_query, source_data, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ai', $10, $11, 'draft')
     RETURNING id, slug, title`,
    [
      post.slug,
      post.title,
      post.description,
      post.content,
      post.category,
      post.tags,
      post.seo_title,
      post.seo_description,
      post.read_time_minutes,
      sourceQuery,
      JSON.stringify(data),
    ]
  );

  if (!result) throw new Error("Failed to insert blog post");
  return result;
}

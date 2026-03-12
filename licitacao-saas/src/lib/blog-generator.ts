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
  cover_search_term: string;
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

// Unsplash images by category (royalty-free, no API key needed)
const COVER_SEARCH_TERMS: Record<string, string[]> = {
  resumo_semanal: ["government building brazil", "business meeting office", "contract signing"],
  top_valor: ["business opportunity", "investment growth chart", "corporate finance"],
  segmento: ["market analysis data", "industry sectors", "business strategy planning"],
  ranking_cidades: ["brazilian city skyline", "urban development brazil", "city business district"],
  guia: ["business education learning", "professional training", "entrepreneur working laptop"],
};

function getUnsplashUrl(searchTerm: string): string {
  // Unsplash Source API - returns a random photo matching the search term
  // 1200x630 is optimal for OG images and blog covers
  return `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=630&fit=crop&q=80`;
}

async function searchUnsplash(term: string): Promise<string> {
  try {
    // Use Unsplash source redirect (no API key needed, returns random matching photo)
    const url = `https://source.unsplash.com/1200x630/?${encodeURIComponent(term)}`;
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
    // The final URL after redirect is the actual image
    return res.url || getUnsplashUrl(term);
  } catch {
    return getUnsplashUrl(term);
  }
}

function buildPrompt(type: BlogPostType, data: unknown): string {
  const tipoLabel: Record<BlogPostType, string> = {
    resumo_semanal: "Resumo Semanal de Licitações",
    top_valor: "Top Oportunidades por Valor",
    segmento: "Análise por Segmento de Mercado",
    ranking_cidades: "Ranking de Cidades com Mais Licitações",
    guia: "Guia Educacional sobre Licitações",
  };

  return `Você é um jornalista especializado em licitações públicas e compras governamentais no Brasil, com 15 anos de experiência cobrindo o setor. Escreve para o blog do LicitaIA com autoridade, profundidade e linguagem acessível.

TIPO DE POST: ${tipoLabel[type]}
DADOS REAIS DO BANCO DE DADOS (use esses números no artigo — NUNCA invente dados):
${JSON.stringify(data, null, 2)}

ESTILO DE ESCRITA OBRIGATÓRIO:
- Escreva como um colunista do Valor Econômico ou JOTA: informativo, analítico, com opinião fundamentada
- Abra com um lide forte (fato impactante ou dado surpreendente) que prenda o leitor
- Use parágrafos curtos (2-3 frases máximo)
- Inclua análise e contexto, não apenas dados — EXPLIQUE o que os números significam
- Quando mencionar valores, compare com referências (ex: "equivalente ao orçamento anual de uma cidade de 50 mil habitantes")
- Inclua pelo menos uma citação ou referência à legislação vigente (Lei 14.133/2021)
- Termine com insight acionável: o que o leitor deve FAZER com essa informação
- Tom: profissional mas humano, nunca burocrático ou robótico
- PROIBIDO: frases genéricas como "neste artigo vamos abordar", "confira abaixo", "sem mais delongas"
- PROIBIDO: listas com mais de 5 itens seguidos (quebre com parágrafos analíticos entre elas)

ESTRUTURA:
- Título chamativo com dado real e número (ex: "R$ 2,3 bilhões em licitações abertas: SP lidera com 40% do volume")
- 1200-2000 palavras em markdown bem formatado
- Subtítulos H2 com keywords SEO naturais (não keyword-stuffing)
- Incluir **pelo menos 3 links internos** naturalmente no texto:
  - /editais/{uf} para estados mencionados (sigla minúscula)
  - /editais?q={keyword} para buscas relevantes
  - /precos para menção de planos
  - /guia/como-participar-de-licitacoes para guia geral
  - /guia/nova-lei-14133-licitacoes para referências à lei
- CTA final natural (não forçado): "O LicitaIA monitora essas oportunidades diariamente..."
- Português correto com acentuação (ç, ã, é, ô, etc.)

CAMPO cover_search_term: inclua um termo de busca em inglês (2-3 palavras) para encontrar uma foto de capa relevante no Unsplash. Ex: "government building", "business meeting", "city skyline brazil"

Retorne APENAS JSON válido (sem markdown wrapping, sem \`\`\`json):
{
  "title": "...",
  "slug": "...-marco-2026",
  "description": "...(max 160 chars, gancho forte)",
  "content": "...(markdown completo, 1200-2000 palavras)",
  "category": "${type === "guia" ? "guia" : type === "resumo_semanal" ? "resumo" : type === "top_valor" ? "mercado" : type === "segmento" ? "analise" : "mercado"}",
  "tags": ["licitação", "pregão", ...],
  "seo_title": "...(max 60 chars, com keyword principal)",
  "seo_description": "...(max 160 chars, com CTA implícito)",
  "read_time_minutes": N,
  "cover_search_term": "..."
}`;
}

async function callGemini(prompt: string): Promise<GeneratedPost> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");

  let cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  // Fix control characters in JSON strings (common Gemini issue)
  cleaned = cleaned.replace(/[\x00-\x1f]/g, (ch: string) => {
    if (ch === "\n") return "\\n";
    if (ch === "\r") return "\\r";
    if (ch === "\t") return "\\t";
    return "";
  });
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

  // Get cover image from Unsplash
  const searchTerm =
    post.cover_search_term ||
    COVER_SEARCH_TERMS[type]?.[Math.floor(Math.random() * (COVER_SEARCH_TERMS[type]?.length || 1))] ||
    "business government";
  const coverImageUrl = await searchUnsplash(searchTerm);

  // Ensure unique slug
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM blog_posts WHERE slug = $1",
    [post.slug]
  );
  if (existing) {
    post.slug = `${post.slug}-${Date.now().toString(36)}`;
  }

  const result = await queryOne<{ id: string; slug: string; title: string }>(
    `INSERT INTO blog_posts (slug, title, description, content, category, tags, seo_title, seo_description, read_time_minutes, cover_image_url, generated_by, source_query, source_data, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ai', $11, $12, 'draft')
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
      coverImageUrl,
      sourceQuery,
      JSON.stringify(data),
    ]
  );

  if (!result) throw new Error("Failed to insert blog post");
  return result;
}

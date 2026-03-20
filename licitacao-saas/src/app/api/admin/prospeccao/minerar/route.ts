import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { query } from "@/lib/db";

// ---------------------------------------------------------------------------
// Mapeamento segmento -> queries de busca no Google Places
// ---------------------------------------------------------------------------
const SEGMENTO_QUERIES: Record<string, string[]> = {
  papel: ["distribuidora de papel", "papelaria atacado", "gráfica"],
  tecnologia: ["empresa de tecnologia", "consultoria TI"],
  saude: [
    "distribuidora material hospitalar",
    "equipamentos médicos",
    "loja de material hospitalar",
  ],
  construcao: ["construtora", "material de construção atacado"],
  alimentos: ["distribuidora de alimentos", "fornecedor alimentos"],
  limpeza: ["distribuidora produtos limpeza", "higiene e limpeza"],
  seguranca: ["empresa segurança patrimonial", "segurança eletrônica"],
  moveis: ["fábrica de móveis", "mobiliário corporativo"],
};

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------
interface PlacesResult {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
}

interface MinedLead {
  nome: string;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  website: string | null;
  rating: number | null;
  avaliacoes: number | null;
  tiposGoogle: string[];
  jaExiste: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTelefone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Remove tudo que nao e digito ou +
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.length < 8) return null;
  return digits;
}

function extrairCidade(endereco: string | null | undefined): string | null {
  if (!endereco) return null;
  // Endereço tipico: "Rua X, 123 - Bairro, Cidade - UF, CEP, Brasil"
  // Tentar pegar a parte antes do " - UF"
  const partes = endereco.split(",").map((p) => p.trim());
  // Geralmente a cidade esta na penultima ou antepenultima parte
  // Formato comum: [..., "Cidade - UF", "CEP-000", "Brasil"]
  for (const parte of partes) {
    const match = parte.match(/^(.+?)\s*-\s*[A-Z]{2}$/);
    if (match) {
      return match[1].trim();
    }
  }
  // Fallback: pegar segunda parte se houver
  if (partes.length >= 3) {
    return partes[partes.length - 3]?.replace(/-.*/, "").trim() || null;
  }
  return null;
}

function extrairUf(endereco: string | null | undefined): string | null {
  if (!endereco) return null;
  const match = endereco.match(/\b([A-Z]{2})\b(?:,\s*\d{5})/);
  if (match) return match[1];
  // Fallback: procurar " - UF" pattern
  const match2 = endereco.match(/-\s*([A-Z]{2})\s*[,\s]/);
  if (match2) return match2[1];
  return null;
}

// ---------------------------------------------------------------------------
// Google Places API - Text Search
// ---------------------------------------------------------------------------
async function searchPlaces(
  textQuery: string,
  apiKey: string
): Promise<PlacesResult[]> {
  const fieldMask = [
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.types",
    "places.rating",
    "places.userRatingCount",
  ].join(",");

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "pt-BR",
        maxResultCount: 20,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error("Cota da API do Google Places excedida. Tente novamente mais tarde.");
    }
    throw new Error(
      `Google Places API retornou status ${response.status}: ${errorBody.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return (data.places || []) as PlacesResult[];
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    // Auth: SUPER_ADMIN
    const session = await auth();
    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Validar env
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_PLACES_API_KEY não configurada no servidor." },
        { status: 500 }
      );
    }

    // Parse body
    const body = await request.json();
    const segmento = cleanString(body.segmento).toLowerCase();
    const uf = cleanString(body.uf).toUpperCase();
    const cidade = cleanString(body.cidade);
    const limite = Math.min(Math.max(Number(body.limite) || 60, 1), 200);

    if (!segmento) {
      return NextResponse.json(
        { error: "Campo 'segmento' é obrigatório." },
        { status: 400 }
      );
    }
    if (!uf || uf.length !== 2) {
      return NextResponse.json(
        { error: "Campo 'uf' deve ser a sigla do estado (ex: SP, RJ)." },
        { status: 400 }
      );
    }

    // Montar queries de busca
    const baseQueries = SEGMENTO_QUERIES[segmento] || [segmento];
    const localSuffix = cidade ? `${cidade}, ${uf}` : uf;

    // Executar buscas no Google Places (1 request por query)
    const allResults: PlacesResult[] = [];
    const seenNames = new Set<string>();
    const errors: string[] = [];

    for (const q of baseQueries) {
      if (allResults.length >= limite) break;

      const textQuery = `${q} em ${localSuffix}`;
      try {
        const results = await searchPlaces(textQuery, apiKey);
        for (const r of results) {
          const name = r.displayName?.text?.toLowerCase() || "";
          if (!name || seenNames.has(name)) continue;
          seenNames.add(name);
          allResults.push(r);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Query "${textQuery}": ${msg}`);
        // Se for erro de cota, parar todas as buscas
        if (msg.includes("Cota")) break;
      }
    }

    if (allResults.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: "Nenhum resultado encontrado. Erros nas buscas:",
          detalhes: errors,
        },
        { status: 502 }
      );
    }

    // Limitar ao limite solicitado
    const trimmed = allResults.slice(0, limite);

    // Verificar duplicatas no portal_leads (por telefone ou nome+cidade)
    const leads: MinedLead[] = [];

    for (const place of trimmed) {
      const nome = place.displayName?.text || "";
      const telefoneRaw =
        place.nationalPhoneNumber || place.internationalPhoneNumber || null;
      const telefone = normalizeTelefone(telefoneRaw);
      const endereco = place.formattedAddress || null;
      const cidadeExtraida = extrairCidade(endereco) || cidade || null;
      const ufExtraida = extrairUf(endereco) || uf || null;

      let jaExiste = false;

      // Checar por telefone
      if (telefone) {
        const byPhone = await query<{ id: string }>(
          `SELECT id FROM portal_leads
           WHERE telefone IS NOT NULL
             AND REPLACE(REPLACE(REPLACE(REPLACE(telefone, ' ', ''), '-', ''), '(', ''), ')', '')
             LIKE '%' || $1 || '%'
           LIMIT 1`,
          [telefone.replace(/^\+?55/, "").slice(-8)]
        );
        if (byPhone.length > 0) jaExiste = true;
      }

      // Se nao encontrou por telefone, checar por nome+cidade
      if (!jaExiste && nome && cidadeExtraida) {
        const byName = await query<{ id: string }>(
          `SELECT id FROM portal_leads
           WHERE LOWER(empresa) = LOWER($1)
             AND (
               LOWER(interesse) LIKE '%' || LOWER($2) || '%'
               OR LOWER(COALESCE(qualification_data->>'cidade', '')) = LOWER($2)
             )
           LIMIT 1`,
          [nome, cidadeExtraida]
        );
        if (byName.length > 0) jaExiste = true;
      }

      leads.push({
        nome,
        telefone: telefoneRaw,
        endereco,
        cidade: cidadeExtraida,
        uf: ufExtraida,
        website: place.websiteUri || null,
        rating: place.rating || null,
        avaliacoes: place.userRatingCount || null,
        tiposGoogle: place.types || [],
        jaExiste,
      });
    }

    const novos = leads.filter((l) => !l.jaExiste);
    const duplicados = leads.filter((l) => l.jaExiste);

    return NextResponse.json({
      success: true,
      resumo: {
        segmento,
        uf,
        cidade: cidade || null,
        totalEncontrados: leads.length,
        novos: novos.length,
        duplicados: duplicados.length,
        queriesExecutadas: baseQueries.map((q) => `${q} em ${localSuffix}`),
      },
      leads: novos,
      duplicados,
      avisos: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("[MINERAR] Erro na mineração de leads:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

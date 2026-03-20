import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface BrasilApiCnpj {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  descricao_situacao_cadastral: string;
  ddd_telefone_1: string | null;
  ddd_telefone_2: string | null;
  email: string | null;
  uf: string;
  municipio: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cep: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>;
  data_inicio_atividade: string;
  porte: string;
  natureza_juridica: string;
  capital_social: number;
  qsa: Array<{ nome_socio: string; qualificacao_socio: string }>;
}

interface CnpjEnriquecido {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string;
  telefone1: string | null;
  telefone2: string | null;
  email: string | null;
  uf: string;
  municipio: string;
  endereco: string;
  cep: string;
  cnaePrincipal: string;
  cnaeDescricao: string;
  dataAbertura: string;
  porte: string;
  capitalSocial: number;
  socios: Array<{ nome: string; qualificacao: string }>;
  erro?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanCnpj(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function isValidCnpj(cnpj: string): boolean {
  const digits = cleanCnpj(cnpj);
  return digits.length === 14;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCnpj(cnpj: string): Promise<CnpjEnriquecido> {
  const digits = cleanCnpj(cnpj);

  const response = await fetch(
    `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
    {
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return {
        cnpj: digits,
        razaoSocial: "",
        nomeFantasia: null,
        situacao: "NAO_ENCONTRADO",
        telefone1: null,
        telefone2: null,
        email: null,
        uf: "",
        municipio: "",
        endereco: "",
        cep: "",
        cnaePrincipal: "",
        cnaeDescricao: "",
        dataAbertura: "",
        porte: "",
        capitalSocial: 0,
        socios: [],
        erro: `CNPJ ${digits} não encontrado na Receita Federal.`,
      };
    }
    if (response.status === 429) {
      throw new Error("Rate limit da BrasilAPI excedido. Tente novamente em alguns minutos.");
    }
    throw new Error(`BrasilAPI retornou status ${response.status} para CNPJ ${digits}.`);
  }

  const data = (await response.json()) as BrasilApiCnpj;

  const endereco = [data.logradouro, data.numero, data.complemento, data.bairro]
    .filter(Boolean)
    .join(", ");

  return {
    cnpj: data.cnpj,
    razaoSocial: data.razao_social,
    nomeFantasia: data.nome_fantasia,
    situacao: data.descricao_situacao_cadastral,
    telefone1: data.ddd_telefone_1 || null,
    telefone2: data.ddd_telefone_2 || null,
    email: data.email || null,
    uf: data.uf,
    municipio: data.municipio,
    endereco,
    cep: data.cep,
    cnaePrincipal: String(data.cnae_fiscal),
    cnaeDescricao: data.cnae_fiscal_descricao,
    dataAbertura: data.data_inicio_atividade,
    porte: data.porte,
    capitalSocial: data.capital_social,
    socios: (data.qsa || []).map((s) => ({
      nome: s.nome_socio,
      qualificacao: s.qualificacao_socio,
    })),
  };
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

    // Parse body
    const body = await request.json();
    const cnpjs: string[] = Array.isArray(body.cnpjs) ? body.cnpjs : [];

    if (cnpjs.length === 0) {
      return NextResponse.json(
        {
          error: "Campo 'cnpjs' é obrigatório. Envie um array de CNPJs.",
          exemplo: { cnpjs: ["12.345.678/0001-00", "98765432000199"] },
        },
        { status: 400 }
      );
    }

    // Limite de segurança: no maximo 50 CNPJs por request
    const MAX_CNPJS = 50;
    if (cnpjs.length > MAX_CNPJS) {
      return NextResponse.json(
        {
          error: `Limite de ${MAX_CNPJS} CNPJs por requisição. Envie ${cnpjs.length} em lotes.`,
        },
        { status: 400 }
      );
    }

    // Validar formato
    const invalidos: string[] = [];
    const validos: string[] = [];
    for (const raw of cnpjs) {
      const cnpj = cleanString(raw);
      if (!cnpj || !isValidCnpj(cnpj)) {
        invalidos.push(cnpj || "(vazio)");
      } else {
        validos.push(cleanCnpj(cnpj));
      }
    }

    // Buscar dados de cada CNPJ com rate limit (1 por segundo)
    const resultados: CnpjEnriquecido[] = [];
    const erros: Array<{ cnpj: string; erro: string }> = [];

    for (let i = 0; i < validos.length; i++) {
      const cnpj = validos[i];
      try {
        const resultado = await fetchCnpj(cnpj);
        resultados.push(resultado);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push({ cnpj, erro: msg });
        // Se rate limit, parar de buscar
        if (msg.includes("Rate limit")) break;
      }

      // Rate limit: 1 request por segundo (BrasilAPI pede gentileza)
      if (i < validos.length - 1) {
        await sleep(1000);
      }
    }

    const ativos = resultados.filter(
      (r) => !r.erro && r.situacao === "ATIVA"
    );
    const inativos = resultados.filter(
      (r) => !r.erro && r.situacao !== "ATIVA"
    );
    const naoEncontrados = resultados.filter((r) => !!r.erro);

    return NextResponse.json({
      success: true,
      resumo: {
        totalEnviados: cnpjs.length,
        validosConsultados: validos.length,
        invalidos: invalidos.length,
        ativos: ativos.length,
        inativos: inativos.length,
        naoEncontrados: naoEncontrados.length,
        errosApi: erros.length,
      },
      empresas: resultados,
      invalidos: invalidos.length > 0 ? invalidos : undefined,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("[MINERAR-CNPJ] Erro no enriquecimento:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

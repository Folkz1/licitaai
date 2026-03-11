export interface OnboardingContext {
  empresa: {
    razao_social: string;
    nome_fantasia: string;
    porte: string;
    setor: string;
    descricao: string;
  };
  ramo: {
    principal: string;
    secundario: string[];
    experiencia_pregao: boolean;
    tipos_clientes: string[];
    keywords_base: {
      inclusao: string[];
      exclusao: string[];
    };
  };
  produtos: {
    lista: string;
    palavras_chave_manual: string[];
    exclusoes: string;
  };
  preferencias: {
    ufs: string[];
    municipios: string[];
    modalidades: Array<{ codigo: string; nome: string }>;
    valor_minimo: number;
    valor_maximo: number | null;
    dias_retroativos: number;
  };
}

export interface GeneratedSearchConfig {
  ufs_prioritarias: string[];
  modalidades_recomendadas: number[];
  valor_minimo_sugerido: number;
  valor_maximo_sugerido: number | null;
  dias_retroativos: number;
  buscar_srp: boolean;
  buscar_me_epp: boolean;
}

export interface GeneratedOnboardingConfig {
  keywords_inclusao: string[];
  keywords_exclusao: string[];
  filtros_busca: GeneratedSearchConfig;
  prompt_pre_triagem: string;
  prompt_analise: string;
  justificativa: string;
}

export const RAMO_KEYWORDS: Record<string, { inclusao: string[]; exclusao: string[] }> = {
  GRAFICO: {
    inclusao: ["impressao", "grafica", "material grafico", "banner", "folder", "cartao de visita"],
    exclusao: ["serigrafia", "outdoor", "sinalizacao"],
  },
  TI: {
    inclusao: ["software", "sistema", "ti", "informatica", "desenvolvimento", "tecnologia"],
    exclusao: ["hardware", "infraestrutura", "cabos"],
  },
  CONSTRUCAO: {
    inclusao: ["construcao", "obra", "engenharia", "reforma", "edificacao"],
    exclusao: ["demolicao", "terraplanagem"],
  },
  ALIMENTOS: {
    inclusao: ["alimentacao", "merenda", "alimentos", "refeicao", "nutricao"],
    exclusao: ["bebida alcoolica", "fumo"],
  },
  TRANSPORTE: {
    inclusao: ["transporte", "frete", "logistica", "locacao", "veiculo"],
    exclusao: ["aereo", "maritimo"],
  },
  SAUDE: {
    inclusao: ["saude", "medicamento", "hospitalar", "medico", "clinico"],
    exclusao: ["estetico", "cosmetico"],
  },
  EDUCACAO: {
    inclusao: ["educacao", "curso", "treinamento", "capacitacao", "ensino"],
    exclusao: ["graduacao", "pos-graduacao"],
  },
  LIMPEZA: {
    inclusao: ["limpeza", "conservacao", "jardinagem", "higienizacao"],
    exclusao: ["desinfeccao hospitalar"],
  },
  EQUIPAMENTOS: {
    inclusao: ["equipamento", "material", "fornecimento", "aquisicao"],
    exclusao: ["locacao de mao de obra"],
  },
  SERVICOS_GERAIS: {
    inclusao: ["servico", "terceirizacao", "manutencao"],
    exclusao: [],
  },
};

export const MODALIDADES_PNCP: Record<string, string> = {
  "1": "Pregao Eletronico",
  "2": "Concorrencia",
  "6": "Dispensa de Licitacao",
  "8": "Credenciamento",
  "9": "Pregao Presencial",
  "10": "RDC",
};

const SEGMENT_KEYWORDS: Array<{ ramo: string; keywords: string[] }> = [
  { ramo: "TI", keywords: ["software", "sistema", "ti", "tecnologia", "informatica", "dados", "automacao"] },
  { ramo: "GRAFICO", keywords: ["grafica", "impressao", "banner", "folder", "papelaria", "material grafico"] },
  { ramo: "SAUDE", keywords: ["medico", "hospital", "saude", "clinica", "medicamento", "laboratorio"] },
  { ramo: "CONSTRUCAO", keywords: ["obra", "engenharia", "reforma", "construcao", "edificacao"] },
  { ramo: "ALIMENTOS", keywords: ["alimento", "merenda", "refeicao", "nutricao", "cozinha"] },
  { ramo: "TRANSPORTE", keywords: ["transporte", "logistica", "frete", "veiculo", "entrega"] },
  { ramo: "LIMPEZA", keywords: ["limpeza", "conservacao", "jardinagem", "higienizacao"] },
  { ramo: "EDUCACAO", keywords: ["curso", "educacao", "treinamento", "capacitacao", "ensino"] },
  { ramo: "EQUIPAMENTOS", keywords: ["equipamento", "fornecimento", "material", "insumo"] },
];

const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function mapSegmentToRamoPrincipal(segment: string): string {
  const normalized = normalize(segment);

  for (const candidate of SEGMENT_KEYWORDS) {
    if (candidate.keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
      return candidate.ramo;
    }
  }

  return "SERVICOS_GERAIS";
}

export function extractKeywordsFromText(text: string, limit = 8): string[] {
  const stopWords = new Set([
    "para", "com", "sem", "uma", "mais", "isso", "essa", "esse", "pela", "pelo", "sobre",
    "quero", "preciso", "empresa", "servico", "servicos", "produto", "produtos", "estado",
    "estados", "brasil", "teste", "trial", "licitacao", "licitacoes",
  ]);

  return Array.from(
    new Set(
      text
        .split(/[,\n;/]+|\s+/)
        .map((item) => normalize(item).trim())
        .filter((item) => item.length >= 4 && !stopWords.has(item))
    )
  ).slice(0, limit);
}

export function extractUfsFromText(text: string): string[] {
  const normalized = text.toUpperCase();

  if (normalized.includes("BRASIL") || normalized.includes("TODO")) {
    return [];
  }

  return BRAZIL_UFS.filter((uf) => new RegExp(`\\b${uf}\\b`).test(normalized));
}

export function buildOnboardingContext(params: {
  step1: Record<string, unknown>;
  step2: Record<string, unknown>;
  step3: Record<string, unknown>;
  step4: Record<string, unknown>;
}): OnboardingContext {
  const ramoPrincipal = (params.step2.ramo_principal as string) || "SERVICOS_GERAIS";
  const ramoKeywords = RAMO_KEYWORDS[ramoPrincipal] || { inclusao: [], exclusao: [] };
  const modalidadesRaw = (params.step4.modalidades || []) as Array<number | string>;

  return {
    empresa: {
      razao_social: String(params.step1.razao_social || ""),
      nome_fantasia: String(params.step1.nome_fantasia || ""),
      porte: String(params.step1.porte || "NAO INFORMADO"),
      setor: String(params.step1.setor || "NAO INFORMADO"),
      descricao: String(params.step1.descricao_livre || ""),
    },
    ramo: {
      principal: ramoPrincipal,
      secundario: (params.step2.ramo_secundario as string[]) || [],
      experiencia_pregao: Boolean(params.step2.experiencia_pregao),
      tipos_clientes: (params.step2.tipos_clientes as string[]) || [],
      keywords_base: ramoKeywords,
    },
    produtos: {
      lista: String(params.step3.produtos_servicos || ""),
      palavras_chave_manual: (params.step3.palavras_chave_manual as string[]) || [],
      exclusoes: String(params.step3.exclusoes || ""),
    },
    preferencias: {
      ufs: (params.step4.ufs_interesse as string[]) || [],
      municipios: (params.step4.municipios_interesse as string[]) || [],
      modalidades: modalidadesRaw.map((modalidade) => ({
        codigo: String(modalidade),
        nome: MODALIDADES_PNCP[String(modalidade)] || "Desconhecida",
      })),
      valor_minimo: Number(params.step4.valor_minimo || 0),
      valor_maximo: params.step4.valor_maximo ? Number(params.step4.valor_maximo) : null,
      dias_retroativos: Number(params.step4.dias_retroativos || 15),
    },
  };
}

export function generateTemplateConfig(context: OnboardingContext): GeneratedOnboardingConfig {
  const ramoKeywords = context.ramo.keywords_base || { inclusao: [], exclusao: [] };
  const produtosLista = context.produtos.lista || "";
  const exclusoes = context.produtos.exclusoes || "";
  const palavrasManuais = context.produtos.palavras_chave_manual || [];

  const produtosWords = produtosLista
    .toLowerCase()
    .split(/[,\n]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3);

  const keywordsInclusao = [
    ...new Set([
      ...ramoKeywords.inclusao,
      ...produtosWords,
      ...palavrasManuais,
    ]),
  ].slice(0, 20);

  const keywordsExclusao = [
    ...new Set([
      ...ramoKeywords.exclusao,
      ...exclusoes
        .toLowerCase()
        .split(/[,\n]+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 3),
    ]),
  ].slice(0, 10);

  const ufs = context.preferencias.ufs || [];
  const modalidades = (context.preferencias.modalidades || []).map((item) => parseInt(item.codigo, 10)) || [1, 6];
  const valorMinimo = context.preferencias.valor_minimo || 0;
  const valorMaximo = context.preferencias.valor_maximo;
  const diasRetroativos = context.preferencias.dias_retroativos || 15;
  const porte = context.empresa.porte || "";
  const empresaNome = context.empresa.razao_social || context.empresa.nome_fantasia || "a empresa";
  const ramoNome = context.ramo.principal || "nao especificado";

  return {
    keywords_inclusao: keywordsInclusao,
    keywords_exclusao: keywordsExclusao,
    filtros_busca: {
      ufs_prioritarias: ufs,
      modalidades_recomendadas: modalidades,
      valor_minimo_sugerido: valorMinimo,
      valor_maximo_sugerido: valorMaximo,
      dias_retroativos: diasRetroativos,
      buscar_srp: true,
      buscar_me_epp: ["ME", "EPP", "MEI"].includes(porte),
    },
    prompt_pre_triagem: `SOBRE A EMPRESA:
- Nome: ${empresaNome}
- Segmento: ${ramoNome}
- Porte: ${porte || "Nao informado"}
- Produtos/Servicos: ${produtosLista || "Nao especificado"}

CRITERIOS PARA ANALISAR (enviar para analise detalhada se mencionar):
${keywordsInclusao.map((keyword) => `- ${keyword}`).join("\n")}
- Licitacoes genericas que possam incluir itens do segmento

CRITERIOS DE REJEICAO IMEDIATA:
${keywordsExclusao.map((keyword) => `- ${keyword}`).join("\n")}
- Produtos/servicos claramente fora do segmento da empresa
- Obras, construcao civil (se nao for do ramo)
- Veiculos, combustiveis (se nao for do ramo)`,
    prompt_analise: `Analise este edital para ${empresaNome}, empresa do setor ${ramoNome}.

SOBRE A EMPRESA:
- Porte: ${porte || "Nao informado"}
- Produtos/Servicos: ${produtosLista || "Nao especificado"}
- Palavras-chave relevantes: ${keywordsInclusao.join(", ")}

CRITERIOS DE RELEVANCIA:
1. Verificar se ha itens relacionados aos produtos/servicos oferecidos
2. Identificar exigencias tecnicas compativeis
3. Verificar restricoes de porte (${porte || "Nao informado"})
4. Calcular valor dos itens relevantes vs total

PONTOS DE ATENCAO:
- Prazos de entrega
- Exigencias de certificacao
- Modalidade de participacao
- Garantias exigidas
- Exigencia de amostras`,
    justificativa: "Configuracao gerada automaticamente com base nos dados fornecidos e templates do setor.",
  };
}

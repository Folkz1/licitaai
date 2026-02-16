// Gera prompts automáticos baseados nos dados do onboarding
export function generatePrompts(context: {
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
  };
  produtos: {
    lista: string;
    palavras_chave_manual: string[];
    exclusoes: string[];
  };
  preferencias: {
    ufs: string[];
    modalidades: { codigo: string; nome: string }[];
    valor_minimo: number;
    valor_maximo: number | null;
  };
}): {
  PRE_TRIAGEM: string;
  ANALISE_COMPLETA: string;
} {
  const { empresa, produtos, preferencias } = context;
  
  // Extrair keywords do produtos
  const keywordsInclusao = [
    ...produtos.palavras_chave_manual,
    ...produtos.lista.toLowerCase().split(/[,\n]+/).map(w => w.trim()).filter(w => w.length > 2)
  ].slice(0, 15);
  
  const keywordsExclusao = produtos.exclusoes
    .map(e => e.toLowerCase())
    .split(/[,\n]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2)
    .slice(0, 10);

  const ufs = preferencias.ufs?.length > 0 ? preferencias.ufs.join(', ') : 'Todas';
  const modalidades = preferencias.modalidades?.map(m => m.nome).join(', ') || 'Todas';

  // Prompt de Pré-Triagem
  const PRE_TRIAGEM = `Você é um classificador especializado em licitações públicas.

## EMPRESA
Nome: ${empresa.nome_fantasia || empresa.razao_social}
Segmento: ${empresa.setor || 'Geral'}
Porte: ${empresa.porte || 'Não informado'}

## PRODUTOS/SERVIÇOS DE INTERESSE (palavras de inclusão)
${keywordsInclusao.join(', ') || 'Não especificado'}

## PRODUTOS/SERVIÇOS DE EXCLUSÃO (palavras de exclusão)
${keywordsExclusao.join(', ') || 'Nenhum'}

## DADOS DA LICITAÇÃO
- Órgão: {{ $json.orgao_nome }}
- Objeto: {{ $json.objeto_compra }}
- Valor: R$ {{ $json.valor_total }}
- Modalidade: {{ $json.modalidade }}
- UF: {{ $json.uf }}

## SUA TAREFA
Analise o objeto da licitação e decida se PODE ter itens relevantes para esta empresa.

## CRITÉRIOS DE REJEIÇÃO (responda REJEITAR)
- Produtos/serviços listados em EXCLUSÃO
- Itens明显mente fora do segmento da empresa
- Licitações de outro setor

## CRITÉRIOS PARA ANÁLISE (responda ANALISAR)
- Menção a qualquer palavra de INCLUSÃO
- Produtos/serviços similares aos oferecidos
- Licitações genéricas que podem incluir itens relevantes

## FORMATO DE RESPOSTA
Responda APENAS com JSON válido:
{
  "decisao": "ANALISAR" ou "REJEITAR",
  "motivo": "Justificativa em 1 linha",
  "confianca": 0-100
}`;

  // Prompt de Análise Completa
  const ANALISE_COMPLETA = `Você é um Analista de Licitações Sênior, especializado em EXTRAÇÃO de dados de editais.

## EMPRESA
Nome: ${empresa.nome_fantasia || empresa.razao_social}
Porte: ${empresa.porte || 'Não informado'}
Foco: ${ufs} | Modalidades: ${modalidades}

## PRODUTOS/SERVIÇOS OFERECIDOS
${produtos.lista || 'Não especificado'}

## PALAVRAS-CHAVE DE INTERESSE
${keywordsInclusao.join(', ')}

## PRODUTOS FORA DO ESCOPO
${keywordsExclusao.join(', ') || 'Nenhum'}

## REGRAS ANTI-ALUCINAÇÃO
1. Extraia APENAS informações presentes no TEXTO DO EDITAL
2. Se um dado não estiver explícito, retorne null/0/[]
3. NÃO invente informações
4. Para cada item, cite a evidência do texto

## DADOS DA LICITAÇÃO
- Objeto: {{ $('Preparar Documentos OCR').first().json.objeto_compra }}
- Valor: R$ {{ $('Preparar Documentos OCR').first().json.valor_total_estimado }}
- UF: {{ $('Preparar Documentos OCR').first().json.uf }}

## FORMATO DE RESPOSTA
{
  "resumo": { "objeto_resumido": "...", "prazo_execucao": "...", "valor_global_estimado": 0 },
  "analise": { "relevancia": "ALTA|MEDIA|BAIXA", "pontos_fortes": [], "pontos_atencao": [], "amostra_exigida": true/false },
  "itens": [
    { "numero": 1, "descricao": "...", "quantidade": 0, "unidade": "...", "valor_unitario": 0, "e_produto_relevante": true/false, "evidencia": "trecho do edital" }
  ],
  "prioridade": "P1|P2|P3|REJEITAR",
  "justificativa": "..."
}`;

  return {
    PRE_TRIAGEM,
    ANALISE_COMPLETA
  };
}

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
<<<<<<< HEAD
import { query, queryOne } from '@/lib/db';
=======
import { queryOne } from '@/lib/db';
>>>>>>> master
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const SYSTEM_PROMPT = `Você é um especialista em licitações públicas brasileiras e no sistema PNCP. 
Sua tarefa é analisar os dados de uma empresa e gerar configurações otimizadas para busca e análise de licitações.

## Tarefas

### 1. Keywords de Inclusão
Gere uma lista de 10-20 palavras-chave de inclusão relevantes para o negócio.
Considere:
- Sinônimos e variações (ex: "impressão" → "imprimir", "impresso")
- Termos técnicos do setor
- Códigos de catálogo de materiais quando aplicável
- Termos usados em editais do setor

### 2. Keywords de Exclusão
Gere uma lista de 5-10 palavras-chave de exclusão para filtrar licitações não relevantes.
Considere:
- Produtos/serviços similares mas não oferecidos
- Setores adjacentes mas não atendidos
- Termos que indicam incompatibilidade

### 3. Filtros de Busca
Sugira configurações de busca otimizadas:
- UFs prioritárias baseadas no porte e logística
- Modalidades mais adequadas ao perfil
- Faixa de valores recomendada

<<<<<<< HEAD
### 4. Prompt de Análise Personalizado
Crie um prompt personalizado para análise de editais que considere:
- Produtos/serviços específicos da empresa
- Critérios de relevância
- Pontos de atenção em editais
=======
### 4. Prompt de Pré-Triagem
Crie um bloco de contexto para classificação rápida de licitações. Deve conter:
- Seção "SOBRE A EMPRESA" com nome, segmento e produtos/serviços principais
- Seção "CRITÉRIOS PARA ANALISAR" com termos e categorias que indicam relevância
- Seção "CRITÉRIOS DE REJEIÇÃO" com categorias claramente irrelevantes
O prompt será usado por uma IA para decidir rapidamente se uma licitação merece análise detalhada.

### 5. Prompt de Análise Completa
Crie um prompt personalizado para análise detalhada de editais que considere:
- Produtos/serviços específicos da empresa
- Critérios de relevância e priorização
- Pontos de atenção em editais
- Regras de porte (ME/EPP se aplicável)
>>>>>>> master

## Formato de Resposta
Responda APENAS em JSON válido no seguinte formato:
{
  "keywords_inclusao": [...],
  "keywords_exclusao": [...],
  "filtros_busca": {
    "ufs_prioritarias": [...],
    "modalidades_recomendadas": [...],
    "valor_minimo_sugerido": number,
    "valor_maximo_sugerido": number,
    "dias_retroativos": number,
    "buscar_srp": boolean,
    "buscar_me_epp": boolean
  },
<<<<<<< HEAD
=======
  "prompt_pre_triagem": "...",
>>>>>>> master
  "prompt_analise": "...",
  "justificativa": "..."
}`;

// Mapeamento de ramos para keywords base
const RAMO_KEYWORDS: Record<string, { inclusao: string[]; exclusao: string[] }> = {
  GRAFICO: {
    inclusao: ['impressão', 'gráfica', 'material gráfico', 'banner', 'folder', 'cartão de visita'],
    exclusao: ['serigrafia', 'outdoor', 'sinalização']
  },
  TI: {
    inclusao: ['software', 'sistema', 'TI', 'informática', 'desenvolvimento', 'tecnologia'],
    exclusao: ['hardware', 'infraestrutura', 'cabos']
  },
  CONSTRUCAO: {
    inclusao: ['construção', 'obra', 'engenharia', 'reforma', 'edificação'],
    exclusao: ['demolição', 'terraplanagem']
  },
  ALIMENTOS: {
    inclusao: ['alimentação', 'merenda', 'alimentos', 'refeição', 'nutrição'],
    exclusao: ['bebida alcoólica', 'fumo']
  },
  TRANSPORTE: {
    inclusao: ['transporte', 'frete', 'logística', 'locação', 'veículo'],
    exclusao: ['aéreo', 'marítimo']
  },
  SAUDE: {
    inclusao: ['saúde', 'medicamento', 'hospitalar', 'médico', 'clínico'],
    exclusao: ['estético', 'cosmético']
  },
  EDUCACAO: {
    inclusao: ['educação', 'curso', 'treinamento', 'capacitação', 'ensino'],
    exclusao: ['graduação', 'pós-graduação']
  },
  LIMPEZA: {
    inclusao: ['limpeza', 'conservação', 'jardinagem', 'higienização'],
    exclusao: ['desinfecção hospitalar']
  },
  EQUIPAMENTOS: {
    inclusao: ['equipamento', 'material', 'fornecimento', 'aquisição'],
    exclusao: ['locação de mão de obra']
  },
  SERVICOS_GERAIS: {
    inclusao: ['serviço', 'terceirização', 'manutenção'],
    exclusao: []
  }
};

// Modalidades PNCP
const MODALIDADES_PNCP: Record<string, string> = {
  '1': 'Pregão Eletrônico',
  '2': 'Concorrência',
  '6': 'Dispensa de Licitação',
  '8': 'Credenciamento',
  '9': 'Pregão Presencial',
  '10': 'RDC'
};

// Helper para extrair JSON de respostas que podem conter Markdown
function extractJSON(text: string) {
  try {
    // 1. Tentar parse direto
    return JSON.parse(text);
  } catch (e) {
    // 2. Tentar extrair de blocos de código markdown ```json ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch (e2) {
        console.error('Falha ao parsear JSON extraído de markdown:', e2);
      }
    }
    
    // 3. Tentar encontrar qualquer coisa que pareça um objeto JSON { ... }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (e3) {
        console.error('Falha ao parsear JSON extraído por busca de chaves:', e3);
      }
    }
    
    throw new Error('Não foi possível extrair um JSON válido da resposta da IA');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return new Response('Não autorizado', { status: 401 });
    }

    // Buscar sessão de onboarding
    const onboardingSession = await queryOne<{
      id: string;
      step_1_data: Record<string, unknown>;
      step_2_data: Record<string, unknown>;
      step_3_data: Record<string, unknown>;
      step_4_data: Record<string, unknown>;
    }>(
      `SELECT id, step_1_data, step_2_data, step_3_data, step_4_data 
       FROM onboarding_sessions 
       WHERE tenant_id = $1 AND status = 'IN_PROGRESS'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [session.user.tenantId]
    );

    if (!onboardingSession) {
      return new Response('Sessão de onboarding não encontrada', { status: 404 });
    }

    // Montar contexto para IA
    const step1 = onboardingSession.step_1_data || {};
    const step2 = onboardingSession.step_2_data || {};
    const step3 = onboardingSession.step_3_data || {};
    const step4 = onboardingSession.step_4_data || {};

    // Adicionar keywords base do ramo se disponível
    const ramoPrincipal = (step2.ramo_principal as string) || 'OUTRO';
    const ramoKeywords = RAMO_KEYWORDS[ramoPrincipal] || { inclusao: [], exclusao: [] };
    
    // Extrair modalidades com tipo correto
    const modalidadesRaw = (step4.modalidades || []) as Array<number | string>;
    const modalidades = modalidadesRaw.map((m) => ({
      codigo: String(m),
      nome: MODALIDADES_PNCP[String(m)] || 'Desconhecida'
    }));

    const context = {
      empresa: {
        razao_social: step1.razao_social || '',
        nome_fantasia: step1.nome_fantasia || '',
        porte: step1.porte || 'NÃO INFORMADO',
        setor: step1.setor || 'NÃO INFORMADO',
        descricao: step1.descricao_livre || ''
      },
      ramo: {
        principal: ramoPrincipal,
        secundario: step2.ramo_secundario || [],
        experiencia_pregao: step2.experiencia_pregao || false,
        tipos_clientes: step2.tipos_clientes || [],
        keywords_base: ramoKeywords
      },
      produtos: {
        lista: step3.produtos_servicos || '',
        palavras_chave_manual: step3.palavras_chave_manual || [],
        exclusoes: step3.exclusoes || ''
      },
      preferencias: {
        ufs: step4.ufs_interesse || [],
        municipios: step4.municipios_interesse || [],
        modalidades: modalidades,
        valor_minimo: step4.valor_minimo || 0,
        valor_maximo: step4.valor_maximo || null,
        dias_retroativos: step4.dias_retroativos || 15
      }
    };

    // Verificar se tem API key configurada (OpenRouter ou OpenAI)
    const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.openrouter;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!openrouterKey && !openaiKey) {
      // Se não tem API key, gerar configuração baseada em templates
      const templateConfig = generateTemplateConfig(context);
      
      // Salvar configuração gerada
      await queryOne(
        `UPDATE onboarding_sessions 
         SET ai_generated_config = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(templateConfig), onboardingSession.id]
      );
      
      // Retornar JSON diretamente
      return new Response(JSON.stringify(templateConfig), {
        headers: {
          'Content-Type': 'application/json',
        }
      });
    }

    // Configurar cliente OpenAI ou OpenRouter
    let model;
    if (openrouterKey) {
      // Usar OpenRouter
      const openrouter = createOpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      model = openrouter('x-ai/grok-4.1-fast');
    } else {
      // Usar OpenAI
      const openai = createOpenAI({
        apiKey: openaiKey,
      });
      model = openai('gpt-4o-mini');
    }

    // Usar IA para gerar configuração
    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `Analise os dados da empresa e gere configurações de busca e análise de licitações:\n\n${JSON.stringify(context, null, 2)}`,
      temperature: 0.7,
    });

    // Gerar configuração completa primeiro e salvar no banco
    const fullResponse = await result.text;
    console.log('[ONBOARDING_GEN] Resposta bruta da IA:', fullResponse);
    
    let config;
    try {
      config = extractJSON(fullResponse);
      
      // Salvar configuração gerada
      await queryOne(
        `UPDATE onboarding_sessions 
         SET ai_generated_config = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(config), onboardingSession.id]
      );
    } catch (e) {
      console.error('[ONBOARDING_GEN] Erro ao parsear/salvar configuração:', e);
      // Se falhar o parse da IA, fazemos um fallback para o template (melhor que 500)
      config = generateTemplateConfig(context);
    }

    // Retornar JSON
    return new Response(JSON.stringify(config), {
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Erro na geração de configuração:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500 }
    );
  }
}

// Função para gerar configuração baseada em templates quando não há API key
function generateTemplateConfig(context: {
  empresa: Record<string, unknown>;
  ramo: Record<string, unknown>;
  produtos: Record<string, unknown>;
  preferencias: Record<string, unknown>;
}) {
  const ramoKeywords = (context.ramo.keywords_base as { inclusao: string[]; exclusao: string[] }) || { inclusao: [], exclusao: [] };
  const produtosLista = (context.produtos.lista as string) || '';
  const exclusoes = (context.produtos.exclusoes as string) || '';
  const palavrasManuais = (context.produtos.palavras_chave_manual as string[]) || [];
  
  // Extrair palavras dos produtos
  const produtosWords = produtosLista
    .toLowerCase()
    .split(/[,\n]+/)
    .map(w => w.trim())
    .filter(w => w.length > 3);
  
  // Combinar keywords
  const keywordsInclusao = [
    ...new Set([
      ...ramoKeywords.inclusao,
      ...produtosWords,
      ...palavrasManuais
    ])
  ].slice(0, 20);

  const keywordsExclusao = [
    ...new Set([
      ...ramoKeywords.exclusao,
      ...exclusoes.toLowerCase().split(/[,\n]+/).map(w => w.trim()).filter(w => w.length > 3)
    ])
  ].slice(0, 10);

  const ufs = (context.preferencias.ufs as string[]) || [];
  const modalidades = (context.preferencias.modalidades as Array<{ codigo: string; nome: string }>).map(m => parseInt(m.codigo)) || [1, 6];
  const valorMinimo = (context.preferencias.valor_minimo as number) || 0;
  const valorMaximo = (context.preferencias.valor_maximo as number | null);
  const diasRetroativos = (context.preferencias.dias_retroativos as number) || 15;
  const porte = (context.empresa.porte as string) || '';

<<<<<<< HEAD
=======
  const empresaNome = (context.empresa.razao_social as string) || (context.empresa.nome_fantasia as string) || 'a empresa';
  const ramoNome = (context.ramo.principal as string) || 'não especificado';

>>>>>>> master
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
      buscar_me_epp: ['ME', 'EPP', 'MEI'].includes(porte)
    },
<<<<<<< HEAD
    prompt_analise: `Analise este edital para uma empresa do setor ${(context.ramo.principal as string) || 'não especificado'}.

PRODUTOS/SERVIÇOS OFERECIDOS:
${produtosLista || 'Não especificado'}
=======
    prompt_pre_triagem: `SOBRE A EMPRESA:
- Nome: ${empresaNome}
- Segmento: ${ramoNome}
- Porte: ${porte || 'Não informado'}
- Produtos/Serviços: ${produtosLista || 'Não especificado'}

CRITÉRIOS PARA ANALISAR (enviar para análise detalhada se mencionar):
${keywordsInclusao.map(k => `- ${k}`).join('\n')}
- Licitações genéricas que possam incluir itens do segmento

CRITÉRIOS DE REJEIÇÃO IMEDIATA:
${keywordsExclusao.map(k => `- ${k}`).join('\n')}
- Produtos/serviços claramente fora do segmento da empresa
- Obras, construção civil (se não for do ramo)
- Veículos, combustíveis (se não for do ramo)`,
    prompt_analise: `Analise este edital para ${empresaNome}, empresa do setor ${ramoNome}.

SOBRE A EMPRESA:
- Porte: ${porte || 'Não informado'}
- Produtos/Serviços: ${produtosLista || 'Não especificado'}
- Palavras-chave relevantes: ${keywordsInclusao.join(', ')}
>>>>>>> master

CRITÉRIOS DE RELEVÂNCIA:
1. Verificar se há itens relacionados aos produtos/serviços oferecidos
2. Identificar exigências técnicas compatíveis
3. Verificar restrições de porte (${porte})
<<<<<<< HEAD
4. Calcular valor relevante
=======
4. Calcular valor dos itens relevantes vs total
>>>>>>> master

PONTOS DE ATENÇÃO:
- Prazos de entrega
- Exigências de certificação
- Modalidade de participação
<<<<<<< HEAD
- Garantias exigidas`,
=======
- Garantias exigidas
- Exigência de amostras`,
>>>>>>> master
    justificativa: 'Configuração gerada automaticamente com base nos dados fornecidos e templates do setor.'
  };
}

import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import {
  buildOnboardingContext,
  generateTemplateConfig,
  MODALIDADES_PNCP,
  RAMO_KEYWORDS,
} from "@/lib/onboarding-config";
import {
  applyPublicOnboardingCookie,
  resolveOnboardingContext,
} from "@/lib/public-onboarding";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const SYSTEM_PROMPT = `Voce e um especialista em licitacoes publicas brasileiras e no sistema PNCP.
Sua tarefa e analisar os dados de uma empresa e gerar configuracoes otimizadas para busca e analise de licitacoes.

## Tarefas

### 1. Keywords de Inclusao
Gere uma lista de 10-20 palavras-chave de inclusao relevantes para o negocio.
Considere:
- Sinonimos e variacoes
- Termos tecnicos do setor
- Codigos de catalogo de materiais quando aplicavel
- Termos usados em editais do setor

### 2. Keywords de Exclusao
Gere uma lista de 5-10 palavras-chave de exclusao para filtrar licitacoes nao relevantes.
Considere:
- Produtos/servicos similares mas nao oferecidos
- Setores adjacentes mas nao atendidos
- Termos que indicam incompatibilidade

### 3. Filtros de Busca
Sugira configuracoes de busca otimizadas:
- UFs prioritarias baseadas no porte e logistica
- Modalidades mais adequadas ao perfil
- Faixa de valores recomendada

### 4. Prompt de Pre-Triagem
Crie um bloco de contexto para classificacao rapida de licitacoes. Deve conter:
- Secao "SOBRE A EMPRESA" com nome, segmento e produtos/servicos principais
- Secao "CRITERIOS PARA ANALISAR" com termos e categorias que indicam relevancia
- Secao "CRITERIOS DE REJEICAO" com categorias claramente irrelevantes

### 5. Prompt de Analise Completa
Crie um prompt personalizado para analise detalhada de editais que considere:
- Produtos/servicos especificos da empresa
- Criterios de relevancia e priorizacao
- Pontos de atencao em editais
- Regras de porte (ME/EPP se aplicavel)

## Formato de Resposta
Responda APENAS em JSON valido no seguinte formato:
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
  "prompt_pre_triagem": "...",
  "prompt_analise": "...",
  "justificativa": "..."
}`;

function extractJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch?.[1]) {
      try {
        return JSON.parse(markdownMatch[1].trim());
      } catch (error) {
        console.error("Falha ao parsear JSON do bloco markdown:", error);
      }
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (error) {
        console.error("Falha ao parsear JSON por delimitadores:", error);
      }
    }

    throw new Error("Nao foi possivel extrair JSON valido da resposta da IA.");
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    const context = await resolveOnboardingContext({ createIfMissing: false });
    if (!context) {
      return new Response("Sessao de onboarding nao encontrada", { status: 404 });
    }

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
      [context.tenantId]
    );

    if (!onboardingSession) {
      return new Response("Sessao de onboarding nao encontrada", { status: 404 });
    }

    const step1 = onboardingSession.step_1_data || {};
    const step2 = onboardingSession.step_2_data || {};
    const step3 = onboardingSession.step_3_data || {};
    const step4 = onboardingSession.step_4_data || {};

    const ramoPrincipal = (step2.ramo_principal as string) || "SERVICOS_GERAIS";
    const ramoKeywords = RAMO_KEYWORDS[ramoPrincipal] || { inclusao: [], exclusao: [] };
    const modalidadesRaw = (step4.modalidades || []) as Array<number | string>;
    const modalidades = modalidadesRaw.map((modalidade) => ({
      codigo: String(modalidade),
      nome: MODALIDADES_PNCP[String(modalidade)] || "Desconhecida",
    }));

    const buildCtx = buildOnboardingContext({
      step1,
      step2: {
        ...step2,
        ramo_principal: ramoPrincipal,
        ramo_secundario: (step2.ramo_secundario as string[]) || [],
        experiencia_pregao: Boolean(step2.experiencia_pregao),
        tipos_clientes: (step2.tipos_clientes as string[]) || [],
        keywords_base: ramoKeywords,
      },
      step3,
      step4: {
        ...step4,
        modalidades: modalidades.map((item) => Number(item.codigo)),
      },
    });

    const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.openrouter;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openrouterKey && !openaiKey) {
      const templateConfig = generateTemplateConfig(buildCtx);

      await queryOne(
        `UPDATE onboarding_sessions
         SET ai_generated_config = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(templateConfig), onboardingSession.id]
      );

      const response = new Response(JSON.stringify(templateConfig), {
        headers: { "Content-Type": "application/json" },
      });
      return applyPublicOnboardingCookie(response, context.cookieValue);
    }

    let model;
    if (openrouterKey) {
      const openrouter = createOpenAI({
        apiKey: openrouterKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      model = openrouter("x-ai/grok-4.1-fast");
    } else {
      const openai = createOpenAI({
        apiKey: openaiKey,
      });
      model = openai("gpt-4o-mini");
    }

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `Analise os dados da empresa e gere configuracoes de busca e analise de licitacoes:\n\n${JSON.stringify(buildCtx, null, 2)}`,
      temperature: 0.7,
    });

    const fullResponse = await result.text;
    console.log("[ONBOARDING_GEN] Resposta bruta da IA:", fullResponse);

    let config;
    try {
      config = extractJSON(fullResponse);

      await queryOne(
        `UPDATE onboarding_sessions
         SET ai_generated_config = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(config), onboardingSession.id]
      );
    } catch (error) {
      console.error("[ONBOARDING_GEN] Erro ao parsear/salvar configuracao:", error);
      config = generateTemplateConfig(buildCtx);
    }

    const response = new Response(JSON.stringify(config), {
      headers: { "Content-Type": "application/json" },
    });
    return applyPublicOnboardingCookie(response, context.cookieValue);
  } catch (error) {
    console.error("Erro na geracao de configuracao:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
    });
  }
}

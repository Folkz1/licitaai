import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function extractJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch (e2) {
        console.error('Falha ao parsear JSON extraído de markdown:', e2);
      }
    }
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

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Missing OPENROUTER_API_KEY in .env.local');
    return;
  }

  const openrouter = createOpenAI({
    apiKey: apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const modelName = 'x-ai/grok-4.1-fast';
  console.log(`Testing model: ${modelName}`);

  // Test cases for extractJSON
  console.log('\n--- Testing extractJSON logic ---');
  const test1 = '{"ok": true}';
  const test2 = '```json\n{"ok": true, "source": "markdown"}\n```';
  const test3 = 'Claro, aqui está o JSON:\n```\n{"ok": true, "source": "raw_markdown"}\n```';
  const test4 = '{"ok": true, "extra": "text"} trailing text';
  
  [test1, test2, test3, test4].forEach((t, i) => {
    try {
      const res = extractJSON(t);
      console.log(`Test ${i + 1} passed:`, res);
    } catch (e: any) {
      console.log(`Test ${i + 1} failed:`, e.message);
    }
  });
  console.log('--- End of extractJSON tests ---\n');

  const context = {
    empresa: { razao_social: 'Empresa Teste', porte: 'ME', setor: 'Gráfico', descricao: 'Gráfica rápida e brindes' },
    ramo: { principal: 'GRAFICO', secundario: [], experiencia_pregao: true, tipos_clientes: ['GOVERNO'] },
    produtos: { lista: 'banners, folders, cartões de visita', palavras_chave_manual: [], exclusoes: '' },
    preferencias: { ufs: ['AM'], municipios: [], modalidades: [{ codigo: '1', nome: 'Pregão Eletrônico' }], valor_minimo: 0, valor_maximo: null, dias_retroativos: 15 }
  };

  const systemPrompt = `Você é um especialista em licitações públicas brasileiras e no sistema PNCP. 
Sua tarefa é analisar os dados de uma empresa e gerar configurações otimizadas para busca e análise de licitações.
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
  "prompt_analise": "...",
  "justificativa": "..."
}`;

  try {
    const { text } = await generateText({
      model: openrouter(modelName),
      system: systemPrompt,
      prompt: `Analise os dados da empresa e gere configurações:\n\n${JSON.stringify(context, null, 2)}`,
    });
    console.log('Response:', text);
    try {
      const json = JSON.parse(text);
      console.log('Successfully parsed JSON!');
    } catch (e) {
      console.log('Failed to parse JSON directly. This is a potential bug in the API route.');
    }
  } catch (error) {
    console.error('Error testing OpenRouter:', error);
  }
}

testOpenRouter();

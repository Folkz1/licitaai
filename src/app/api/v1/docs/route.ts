import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "LicitaIA API",
    version: "v1",
    description: "API para consulta de licitacoes do governo brasileiro com analise por IA",
    base_url: "/api/v1",
    authentication: {
      type: "API Key",
      header: "Authorization: Bearer sk-licitaia-xxx",
      alternative_header: "X-API-Key: sk-licitaia-xxx",
      obtain_key: "Dashboard > Configuracoes > API Keys",
    },
    billing: {
      model: "Per-call credits",
      free_tier: "100 credits on signup",
      headers: {
        "X-Credits-Consumed": "Credits used by this request",
        "X-Credits-Remaining": "Your remaining credit balance",
      },
    },
    rate_limits: {
      per_minute: 60,
      per_day: 5000,
      headers: {
        "Retry-After": "Seconds to wait when rate limited (HTTP 429)",
      },
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/licitacoes",
        description: "Listar licitacoes com filtros e paginacao",
        credits: 1,
        params: {
          page: "Pagina (default: 1)",
          limit: "Items por pagina (1-100, default: 20)",
          status: "Filtrar por status: NOVA, ANALISADA, SEM_EDITAL, ERRO_OCR",
          uf: "Filtrar por UF (ex: SP, RJ, MG)",
          search: "Busca textual em objeto e orgao",
          priority: "Filtrar por prioridade: P1, P2, P3, REJEITAR",
          modalidade: "Filtrar por modalidade de contratacao",
          date_from: "Data publicacao inicio (YYYY-MM-DD)",
          date_to: "Data publicacao fim (YYYY-MM-DD)",
          sort_by: "Ordenar por: data_publicacao, data_encerramento_proposta, valor_total_estimado, created_at",
          sort_order: "asc ou desc (default: asc)",
        },
        response: {
          data: "Array de licitacoes",
          pagination: "{ page, limit, total, total_pages }",
          _meta: "{ credits_consumed, credits_remaining, response_time_ms }",
        },
      },
      {
        method: "GET",
        path: "/api/v1/licitacoes/:id",
        description: "Detalhes completos de uma licitacao com analise IA e itens",
        credits: 2,
        response: {
          data: "{ licitacao, analise, itens, total_itens }",
          _meta: "{ credits_consumed, credits_remaining }",
        },
      },
      {
        method: "GET",
        path: "/api/v1/stats",
        description: "Estatisticas e KPIs do seu tenant",
        credits: 1,
        response: {
          data: "{ kpis, by_uf, by_priority }",
        },
      },
      {
        method: "GET",
        path: "/api/v1/usage",
        description: "Seu historico de uso e creditos",
        credits: 0,
        response: {
          credits: "{ balance, total_purchased, total_consumed, free_granted }",
          usage_today: "{ calls, credits_spent }",
          usage_month: "{ calls, credits_spent }",
        },
      },
    ],
    errors: {
      "401": "API key ausente ou invalida",
      "402": "Creditos insuficientes",
      "403": "Key desativada, expirada ou sem permissao",
      "404": "Recurso nao encontrado",
      "429": "Rate limit excedido",
      "500": "Erro interno do servidor",
    },
    examples: {
      curl_list: 'curl -H "Authorization: Bearer sk-licitaia-xxxx" https://seudominio.com/api/v1/licitacoes?uf=SP&priority=P1',
      curl_detail: 'curl -H "X-API-Key: sk-licitaia-xxxx" https://seudominio.com/api/v1/licitacoes/uuid-aqui',
      python: `import requests\n\nheaders = {"Authorization": "Bearer sk-licitaia-xxxx"}\nres = requests.get("https://seudominio.com/api/v1/licitacoes", headers=headers, params={"uf": "SP"})\nprint(res.json())`,
    },
  });
}

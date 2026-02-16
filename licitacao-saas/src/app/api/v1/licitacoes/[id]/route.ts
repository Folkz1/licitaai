import { query, queryOne } from "@/lib/db";
import { withApiKey, trackApiUsage, checkCredits } from "@/lib/api-key";
import { NextRequest, NextResponse } from "next/server";

const ENDPOINT = "GET /api/v1/licitacoes/:id";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  // Authenticate
  const auth = await withApiKey(req, { requiredPermission: "read" });
  if ("error" in auth) return auth.error;
  const { context } = auth;

  // Check credits
  const credits = await checkCredits(context.tenantId, ENDPOINT);
  if (!credits.hasCredits) {
    return NextResponse.json(
      { error: "Insufficient credits", balance: credits.balance, required: credits.required },
      { status: 402 }
    );
  }

  // Fetch licitação
  const licitacao = await queryOne<Record<string, unknown>>(
    `SELECT l.id, l.numero_controle_pncp, l.orgao_nome, l.objeto_compra,
            l.valor_total_estimado, l.modalidade_contratacao, l.tipo_participacao,
            l.situacao_compra, l.data_publicacao, l.data_encerramento_proposta,
            l.uf, l.municipio, l.link_sistema_origem, l.status, l.review_phase,
            l.created_at, l.updated_at
     FROM licitacoes l
     WHERE l.id = $1 AND l.tenant_id = $2`,
    [id, context.tenantId]
  );

  if (!licitacao) {
    return NextResponse.json({ error: "Licitacao not found" }, { status: 404 });
  }

  // Fetch analysis
  const analise = await queryOne<Record<string, unknown>>(
    `SELECT prioridade, tipo_oportunidade, score_relevancia, justificativa,
            valor_itens_relevantes, amostra_exigida, prazo_amostra,
            exclusivo_me_epp, documentos_necessarios, riscos,
            data_sessao, data_limite_proposta, prazos_entrega,
            created_at
     FROM analises
     WHERE licitacao_id = $1`,
    [id]
  );

  // Fetch items
  const itens = await query(
    `SELECT numero_item, descricao, quantidade, unidade,
            valor_unitario_estimado, valor_total_estimado,
            exclusivo_me_epp, cota_reservada
     FROM itens_licitacao
     WHERE licitacao_id = $1
     ORDER BY numero_item`,
    [id]
  );

  // Track usage
  const usage = await trackApiUsage(context, req, ENDPOINT, 200, startTime);

  return NextResponse.json(
    {
      data: {
        licitacao,
        analise: analise || null,
        itens,
        total_itens: itens.length,
      },
      _meta: {
        credits_consumed: usage.creditsConsumed,
        credits_remaining: usage.balanceRemaining,
        response_time_ms: Date.now() - startTime,
      },
    },
    {
      headers: {
        "X-Credits-Consumed": String(usage.creditsConsumed),
        "X-Credits-Remaining": String(usage.balanceRemaining || 0),
      },
    }
  );
}

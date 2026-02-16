import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Public API - returns LIMITED licitação data for shareable pages
// Full analysis, items details, and actions require authentication
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const licitacao = await queryOne<{
    id: string;
    numero_controle_pncp: string;
    orgao_nome: string;
    objeto_compra: string;
    valor_total_estimado: number;
    modalidade_contratacao: string;
    data_publicacao: string;
    data_encerramento_proposta: string;
    uf: string;
    municipio: string;
    link_sistema_origem: string;
    status: string;
    tenant_id: string;
  }>(
    `SELECT id, numero_controle_pncp, orgao_nome, objeto_compra, valor_total_estimado,
            modalidade_contratacao, data_publicacao, data_encerramento_proposta,
            uf, municipio, link_sistema_origem, status, tenant_id
     FROM licitacoes WHERE id = $1`,
    [id]
  );

  if (!licitacao) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get tenant name for branding
  const tenant = await queryOne<{ nome: string; segmento: string }>(
    "SELECT nome, segmento FROM tenants WHERE id = $1",
    [licitacao.tenant_id]
  );

  // Get analysis summary (limited - no full justificativa, no detailed docs)
  const analise = await queryOne<{
    prioridade: string;
    score_relevancia: number;
    justificativa: string;
    valor_itens_relevantes: number;
    amostra_exigida: boolean;
    documentos_necessarios: string;
  }>(
    `SELECT prioridade, score_relevancia, justificativa, valor_itens_relevantes,
            amostra_exigida, documentos_necessarios
     FROM analises WHERE licitacao_id = $1`,
    [id]
  );

  // Count items (don't expose full item details publicly)
  const itemCount = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM itens_licitacao WHERE licitacao_id = $1",
    [id]
  );

  // Truncate justificativa for public view (tease the analysis)
  const publicJustificativa = analise?.justificativa
    ? analise.justificativa.slice(0, 200) + (analise.justificativa.length > 200 ? "..." : "")
    : null;

  // Parse documentos for public (show first 3 only)
  let publicDocs: string[] = [];
  if (analise?.documentos_necessarios) {
    try {
      const docs = JSON.parse(analise.documentos_necessarios);
      publicDocs = Array.isArray(docs) ? docs.slice(0, 3) : [];
    } catch {
      publicDocs = [];
    }
  }

  // Remove tenant_id from response
  const { tenant_id: _tid, ...publicLicitacao } = licitacao;

  return NextResponse.json({
    licitacao: publicLicitacao,
    analise: analise
      ? {
          prioridade: analise.prioridade,
          score_relevancia: analise.score_relevancia,
          justificativa_preview: publicJustificativa,
          valor_itens_relevantes: analise.valor_itens_relevantes,
          amostra_exigida: analise.amostra_exigida,
          documentos_preview: publicDocs,
          total_documentos: publicDocs.length,
        }
      : null,
    item_count: parseInt(itemCount?.count || "0"),
    analyzed_by: tenant?.nome || "LicitaIA",
  });
}

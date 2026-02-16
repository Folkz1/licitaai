import { queryOne, query } from "@/lib/db";
import { Metadata } from "next";
import { PublicLicitacaoView } from "./PublicView";

interface Props {
  params: Promise<{ id: string }>;
}

// Generate dynamic OG tags for social sharing (WhatsApp, LinkedIn, Twitter)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const lic = await queryOne<{
    objeto_compra: string;
    orgao_nome: string;
    valor_total_estimado: number;
    uf: string;
    municipio: string;
    data_encerramento_proposta: string;
  }>(
    `SELECT objeto_compra, orgao_nome, valor_total_estimado, uf, municipio, data_encerramento_proposta
     FROM licitacoes WHERE id = $1`,
    [id]
  );

  if (!lic) {
    return { title: "Licitacao nao encontrada | LicitaIA" };
  }

  const valor = lic.valor_total_estimado
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(lic.valor_total_estimado)
    : "Valor nao informado";

  const title = `${lic.objeto_compra?.slice(0, 70)}...`;
  const description = `${lic.orgao_nome} | ${lic.municipio}/${lic.uf} | ${valor} | Analise por IA disponivel`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    title: `${title} | LicitaIA`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${appUrl}/p/${id}`,
      siteName: "LicitaIA - Analise Inteligente de Licitacoes",
      images: [
        {
          url: `${appUrl}/api/public/og?id=${id}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${appUrl}/api/public/og?id=${id}`],
    },
  };
}

export default async function PublicLicitacaoPage({ params }: Props) {
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
  }>(
    `SELECT id, numero_controle_pncp, orgao_nome, objeto_compra, valor_total_estimado,
            modalidade_contratacao, data_publicacao, data_encerramento_proposta,
            uf, municipio, link_sistema_origem, status
     FROM licitacoes WHERE id = $1`,
    [id]
  );

  if (!licitacao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Licitacao nao encontrada</h1>
          <p className="mt-2 text-slate-400">Essa licitacao pode ter sido removida ou o link esta incorreto.</p>
        </div>
      </div>
    );
  }

  const analise = await queryOne<{
    prioridade: string;
    score_relevancia: number;
    justificativa: string;
    valor_itens_relevantes: number;
    amostra_exigida: boolean;
    documentos_necessarios: string;
    prazos: string;
    requisitos_tecnicos: string;
    analise_riscos: string;
  }>(
    `SELECT prioridade, score_relevancia, justificativa, valor_itens_relevantes,
            amostra_exigida, documentos_necessarios, prazos, requisitos_tecnicos, analise_riscos
     FROM analises WHERE licitacao_id = $1`,
    [id]
  );

  const itemCount = await queryOne<{ count: string; valor_total: string }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(valor_total), 0) as valor_total
     FROM itens_licitacao WHERE licitacao_id = $1`,
    [id]
  );

  return (
    <PublicLicitacaoView
      licitacao={licitacao}
      analise={analise}
      itemCount={parseInt(itemCount?.count || "0")}
      itemValorTotal={parseFloat(itemCount?.valor_total || "0")}
    />
  );
}

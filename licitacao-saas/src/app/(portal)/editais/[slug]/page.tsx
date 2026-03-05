import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Lock,
  ArrowRight,
  Sparkles,
  Shield,
  Clock,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getLicitacao(slug: string) {
  return queryOne<{
    id: string;
    slug: string;
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
    link_edital_pncp: string;
  }>(
    `SELECT id, slug, numero_controle_pncp, orgao_nome, objeto_compra, valor_total_estimado,
            modalidade_contratacao, data_publicacao, data_encerramento_proposta,
            uf, municipio, link_sistema_origem, link_edital_pncp
     FROM licitacoes WHERE slug = $1`,
    [slug]
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lic = await getLicitacao(slug);

  if (!lic) {
    return { title: "Licitação não encontrada | LicitaIA" };
  }

  const valor = lic.valor_total_estimado
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(lic.valor_total_estimado)
    : "Valor não informado";

  const title = lic.objeto_compra?.slice(0, 70) || "Licitação";
  const description = `${lic.orgao_nome} | ${lic.municipio || ""}/${lic.uf || ""} | ${valor} | Análise por IA disponível`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    title: `${title} | LicitaIA`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${appUrl}/editais/${slug}`,
      siteName: "LicitaIA - Busca Inteligente de Licitações",
      images: [
        {
          url: `${appUrl}/api/public/og?id=${lic.id}`,
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
      images: [`${appUrl}/api/public/og?id=${lic.id}`],
    },
  };
}

export default async function EditalDetalhe({ params }: Props) {
  const { slug } = await params;
  const licitacao = await getLicitacao(slug);

  if (!licitacao) notFound();

  // Análise IA (preview)
  const analise = await queryOne<{
    prioridade: string;
    score_relevancia: number;
    justificativa: string;
    documentos_necessarios: string;
  }>(
    `SELECT prioridade, score_relevancia, justificativa, documentos_necessarios
     FROM analises WHERE licitacao_id = $1`,
    [licitacao.id]
  );

  // Itens
  const itens = await query<{
    numero_item: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    valor_total: number;
  }>(
    `SELECT numero_item, descricao, quantidade, unidade, valor_unitario, valor_total
     FROM itens_licitacao WHERE licitacao_id = $1
     ORDER BY numero_item LIMIT 10`,
    [licitacao.id]
  );

  const totalItens = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::TEXT as count FROM itens_licitacao WHERE licitacao_id = $1`,
    [licitacao.id]
  );

  // Related licitações
  const relacionadas = await query<{
    slug: string;
    objeto_compra: string;
    orgao_nome: string;
    valor_total_estimado: number;
    uf: string;
  }>(
    `SELECT slug, objeto_compra, orgao_nome, valor_total_estimado, uf
     FROM licitacoes
     WHERE slug IS NOT NULL AND id != $1 AND (uf = $2 OR orgao_nome = $3)
     ORDER BY data_publicacao DESC NULLS LAST
     LIMIT 5`,
    [licitacao.id, licitacao.uf, licitacao.orgao_nome]
  );

  const prioridadeColors: Record<string, string> = {
    P1: "bg-red-500/15 text-red-400 border-red-500/20",
    P2: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    P3: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    REJEITAR: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  };

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: licitacao.objeto_compra,
    description: licitacao.objeto_compra,
    provider: {
      "@type": "GovernmentOrganization",
      name: licitacao.orgao_nome,
      address: {
        "@type": "PostalAddress",
        addressRegion: licitacao.uf,
        addressLocality: licitacao.municipio,
        addressCountry: "BR",
      },
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: licitacao.uf,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition-colors">Início</Link>
          <span>/</span>
          <Link href="/editais" className="hover:text-slate-300 transition-colors">Editais</Link>
          <span>/</span>
          <span className="text-slate-400 truncate max-w-[300px]">{licitacao.objeto_compra?.slice(0, 50)}...</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                {licitacao.uf && (
                  <Badge variant="outline" className="border-slate-700 text-slate-400">{licitacao.uf}</Badge>
                )}
                {licitacao.modalidade_contratacao && (
                  <Badge variant="outline" className="border-slate-700 text-slate-500">
                    {licitacao.modalidade_contratacao}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl font-bold text-white leading-relaxed sm:text-2xl">
                {licitacao.objeto_compra}
              </h1>
            </div>

            {/* Details Card */}
            <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                Dados da Licitação
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="Órgão" value={licitacao.orgao_nome} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Local" value={`${licitacao.municipio || "—"} / ${licitacao.uf || "—"}`} />
                <InfoRow icon={<Tag className="h-4 w-4" />} label="PNCP" value={licitacao.numero_controle_pncp || "—"} />
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Publicação"
                  value={licitacao.data_publicacao ? new Date(licitacao.data_publicacao).toLocaleDateString("pt-BR") : "—"}
                />
                <InfoRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Encerramento"
                  value={licitacao.data_encerramento_proposta ? new Date(licitacao.data_encerramento_proposta).toLocaleDateString("pt-BR") : "—"}
                />
                <div className="flex items-start gap-3">
                  <div className="text-emerald-400 mt-0.5">
                    <span className="text-lg font-bold">{licitacao.valor_total_estimado ? formatCurrency(licitacao.valor_total_estimado) : "Não informado"}</span>
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800/40">
                {licitacao.link_sistema_origem && (
                  <a
                    href={licitacao.link_sistema_origem}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-400 hover:text-white hover:border-indigo-500/50 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Portal de Origem
                  </a>
                )}
                {licitacao.link_edital_pncp && licitacao.link_edital_pncp !== licitacao.link_sistema_origem && (
                  <a
                    href={licitacao.link_edital_pncp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 py-2 text-xs text-slate-400 hover:text-white hover:border-indigo-500/50 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Edital PNCP
                  </a>
                )}
              </div>
            </div>

            {/* Items Preview */}
            {itens.length > 0 && (
              <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-6">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">
                  Itens ({totalItens?.count || itens.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-left text-xs text-slate-500">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Descrição</th>
                        <th className="pb-2 pr-4 text-right">Qtd</th>
                        <th className="pb-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item) => (
                        <tr key={item.numero_item} className="border-b border-slate-800/30">
                          <td className="py-2.5 pr-4 text-slate-500">{item.numero_item}</td>
                          <td className="py-2.5 pr-4 text-slate-300 max-w-[400px] truncate">{item.descricao}</td>
                          <td className="py-2.5 pr-4 text-right text-slate-400">
                            {item.quantidade} {item.unidade}
                          </td>
                          <td className="py-2.5 text-right text-slate-300">
                            {item.valor_total ? formatCurrency(item.valor_total) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parseInt(totalItens?.count || "0") > 10 && (
                  <p className="mt-3 text-xs text-slate-600">
                    Mostrando 10 de {totalItens?.count} itens.{" "}
                    <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
                      Cadastre-se para ver todos
                    </Link>
                  </p>
                )}
              </div>
            )}

            {/* AI Analysis Preview (Gated) */}
            <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 to-slate-950/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-slate-300">Análise por IA</h2>
              </div>

              {analise ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {analise.prioridade && (
                      <Badge className={`${prioridadeColors[analise.prioridade] || "bg-slate-500/15 text-slate-400"}`}>
                        {analise.prioridade}
                      </Badge>
                    )}
                    {analise.score_relevancia != null && (
                      <span className="text-sm text-slate-400">
                        Score: <span className="font-semibold text-white">{analise.score_relevancia}/10</span>
                      </span>
                    )}
                  </div>

                  {/* Teaser - show truncated justificativa */}
                  {analise.justificativa && (
                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                      {analise.justificativa}
                    </p>
                  )}

                  {/* Gated content */}
                  <div className="relative">
                    <div className="space-y-2 blur-sm select-none pointer-events-none">
                      <div className="h-4 bg-slate-800 rounded w-full" />
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                      <div className="h-4 bg-slate-800 rounded w-5/6" />
                      <div className="h-4 bg-slate-800 rounded w-2/3" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Lock className="mx-auto h-6 w-6 text-indigo-400 mb-2" />
                        <p className="text-sm font-medium text-white">Análise completa disponível na plataforma</p>
                        <Link
                          href="/login"
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                        >
                          Cadastre-se grátis <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Shield className="mx-auto h-8 w-8 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">Análise IA ainda não disponível para esta licitação.</p>
                  <Link
                    href="/login"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Solicite análise na plataforma <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* CTA Card */}
            <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/30 to-slate-950/50 p-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-indigo-400 mb-3" />
              <h3 className="font-semibold text-white">Analise este edital com IA</h3>
              <p className="mt-2 text-xs text-slate-500">
                Receba análise completa: prioridade, riscos, documentos necessários e muito mais.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Acessar Plataforma
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Related */}
            {relacionadas.length > 0 && (
              <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Editais Relacionados</h3>
                <div className="space-y-3">
                  {relacionadas.map((rel) => (
                    <Link
                      key={rel.slug}
                      href={`/editais/${rel.slug}`}
                      className="block group"
                    >
                      <p className="text-xs text-slate-400 line-clamp-2 group-hover:text-white transition-colors">
                        {rel.objeto_compra}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-600">{rel.orgao_nome?.slice(0, 30)}</span>
                        <span className="text-xs font-medium text-emerald-400">
                          {rel.valor_total_estimado ? formatCurrency(rel.valor_total_estimado) : "—"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-slate-500 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-300">{value}</p>
      </div>
    </div>
  );
}

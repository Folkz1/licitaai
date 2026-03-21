import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID, UF_NAMES, type PortalUf } from "@/lib/portal";
import { SegmentIcon } from "@/lib/segment-icons";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Zap,
  ChevronRight,
  Home,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface Segmento {
  id: number;
  slug: string;
  nome: string;
  descricao: string | null;
  keywords: string[];
  icone: string | null;
}

interface Licitacao {
  slug: string;
  objeto_compra: string;
  orgao_nome: string;
  uf: string;
  municipio: string;
  valor_total_estimado: number;
  data_publicacao: string;
  modalidade_contratacao: string;
  data_encerramento_proposta: string;
  analysis_count: number;
  avg_score: number;
}

interface Props {
  params: Promise<{ segmento: string; uf: string }>;
  searchParams?: Promise<{ page?: string }>;
}

function buildKeywordFilter(): string {
  return `to_tsvector('portuguese', COALESCE(l.objeto_compra, '')) @@ to_tsquery('portuguese', array_to_string(s.keywords, ' | '))`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segmento: segSlug, uf: ufSlug } = await params;
  const ufUpper = ufSlug.toUpperCase();
  const ufName = UF_NAMES[ufUpper as PortalUf];

  const seg = await queryOne<Segmento>(
    `SELECT id, slug, nome, descricao, keywords, icone FROM segmentos WHERE slug = $1`,
    [segSlug]
  );

  if (!seg || !ufName) return { title: "Não encontrado | LicitaIA" };

  const title = `Licitações de ${seg.nome} em ${ufName} (${ufUpper}) | LicitaIA`;
  const description = `Encontre licitações de ${seg.nome.toLowerCase()} em ${ufName}. ${seg.descricao || ""} Dados públicos do PNCP atualizados diariamente.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${APP_URL}/fornecedores/${seg.slug}/${ufSlug.toLowerCase()}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "LicitaIA",
      url: `${APP_URL}/fornecedores/${seg.slug}/${ufSlug.toLowerCase()}`,
    },
  };
}

const LIMIT = 30;

export default async function SegmentoUfPage({ params, searchParams }: Props) {
  const { segmento: segSlug, uf: ufSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const ufUpper = ufSlug.toUpperCase();
  const ufName = UF_NAMES[ufUpper as PortalUf];

  if (!ufName) notFound();

  const seg = await queryOne<Segmento>(
    `SELECT id, slug, nome, descricao, keywords, icone FROM segmentos WHERE slug = $1`,
    [segSlug]
  );
  if (!seg) notFound();

  const page = Math.max(1, parseInt(sp.page || "1"));
  const offset = (page - 1) * LIMIT;

  // Get stats
  const stats = await queryOne<{ total: string; valor: string }>(
    `SELECT COUNT(*)::TEXT as total, COALESCE(SUM(l.valor_total_estimado), 0)::TEXT as valor
     FROM licitacoes l, segmentos s
     WHERE s.slug = $1 AND l.uf = $2 AND l.tenant_id = $3
       AND ${buildKeywordFilter()}`,
    [seg.slug, ufUpper, PORTAL_PUBLIC_TENANT_ID]
  );
  const totalCount = parseInt(stats?.total || "0", 10);
  const valorTotal = parseFloat(stats?.valor || "0");
  const totalPages = Math.ceil(totalCount / LIMIT);

  // Get licitacoes
  const licitacoes = await query<Licitacao>(
    `SELECT l.slug, l.objeto_compra, l.orgao_nome, l.uf, l.municipio,
            l.valor_total_estimado, l.data_publicacao, l.modalidade_contratacao,
            l.data_encerramento_proposta,
            COALESCE(l.analysis_count, 0) as analysis_count, l.avg_score
     FROM licitacoes l, segmentos s
     WHERE s.slug = $1 AND l.uf = $2 AND l.tenant_id = $3 AND l.slug IS NOT NULL
       AND ${buildKeywordFilter()}
     ORDER BY l.data_publicacao DESC NULLS LAST
     LIMIT ${LIMIT} OFFSET ${offset}`,
    [seg.slug, ufUpper, PORTAL_PUBLIC_TENANT_ID]
  );

  function formatCompactValue(v: number) {
    if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return formatCurrency(v);
  }

  function buildPageUrl(p: number) {
    return `/fornecedores/${seg!.slug}/${ufSlug.toLowerCase()}${p > 1 ? `?page=${p}` : ""}`;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="hover:text-white transition-colors">
            <Home className="h-3.5 w-3.5" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/fornecedores" className="hover:text-white transition-colors">
            Fornecedores
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={`/fornecedores/${seg.slug}`}
            className="hover:text-white transition-colors"
          >
            {seg.nome}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-300">{ufName} ({ufUpper})</span>
        </nav>
      </div>

      {/* Header */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <SegmentIcon name={seg.icone} className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Licitações de {seg.nome} em {ufName}
            </h1>
            <p className="text-sm text-slate-500">
              {totalCount.toLocaleString("pt-BR")} resultado{totalCount !== 1 ? "s" : ""}{" "}
              encontrado{totalCount !== 1 ? "s" : ""}
              {valorTotal > 0 && (
                <>
                  {" "}
                  totalizando{" "}
                  <span className="text-emerald-400 font-medium">
                    {formatCompactValue(valorTotal)}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        {licitacoes.length === 0 ? (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-12 text-center">
            <p className="text-slate-400">
              Nenhuma licitação de {seg.nome} encontrada em {ufName}.
            </p>
            <Link
              href={`/fornecedores/${seg.slug}`}
              className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
            >
              Ver todos os estados
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {licitacoes.map((lic) => (
              <Link
                key={lic.slug}
                href={`/editais/${lic.slug}`}
                className="group block rounded-xl border border-slate-800/60 bg-gradient-to-r from-slate-900/80 to-slate-950/50 p-5 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {lic.modalidade_contratacao && (
                        <Badge
                          variant="outline"
                          className="text-xs border-slate-700 text-slate-500 truncate max-w-[200px]"
                        >
                          {lic.modalidade_contratacao}
                        </Badge>
                      )}
                      {lic.municipio && (
                        <Badge
                          variant="outline"
                          className="text-xs border-slate-700 text-slate-400"
                        >
                          {lic.municipio}
                        </Badge>
                      )}
                      {lic.analysis_count > 0 && (
                        <Badge className="text-xs bg-indigo-500/15 text-indigo-400 border-indigo-500/20">
                          <Sparkles className="mr-1 h-3 w-3" />
                          IA{" "}
                          {lic.avg_score != null
                            ? `${Number(lic.avg_score).toFixed(0)}/10`
                            : ""}
                        </Badge>
                      )}
                      {lic.analysis_count > 1 && (
                        <Badge className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                          <Users className="mr-1 h-3 w-3" />
                          {lic.analysis_count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2 group-hover:text-white transition-colors">
                      {lic.objeto_compra}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-600 truncate">
                      {lic.orgao_nome}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">
                      {lic.valor_total_estimado
                        ? formatCurrency(lic.valor_total_estimado)
                        : "-"}
                    </p>
                    {lic.data_publicacao && (
                      <p className="text-xs text-slate-600 mt-1">
                        {new Date(lic.data_publicacao).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {lic.data_encerramento_proposta && (
                      <p className="text-xs text-slate-600">
                        Encerra:{" "}
                        {new Date(lic.data_encerramento_proposta).toLocaleDateString(
                          "pt-BR"
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={buildPageUrl(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-400 hover:text-white hover:border-indigo-500/50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Anterior
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Link
                  key={pageNum}
                  href={buildPageUrl(pageNum)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    pageNum === page
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-700/60 bg-slate-900/80 text-slate-400 hover:text-white hover:border-indigo-500/50"
                  }`}
                >
                  {pageNum}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link
                href={buildPageUrl(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-400 hover:text-white hover:border-indigo-500/50 transition-colors"
              >
                Próxima <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <span className="ml-3 text-xs text-slate-600">
              Página {page} de {totalPages}
            </span>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-indigo-950/20 py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-xl font-bold text-white">
            Configure alertas de {seg.nome} em {ufName}
          </h2>
          <p className="mt-3 text-slate-400">
            Receba por WhatsApp quando novas licitações de {seg.nome.toLowerCase()}{" "}
            forem publicadas em {ufName}. 7 dias grátis, sem cartão.
          </p>
          <div className="mt-6">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-base font-semibold text-slate-950 transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              <Zap className="h-5 w-5" />
              Começar teste grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

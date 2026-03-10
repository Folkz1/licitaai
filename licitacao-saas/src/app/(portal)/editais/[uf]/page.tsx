import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import {
  PORTAL_PUBLIC_TENANT_ID,
  PORTAL_UFS,
  UF_NAMES,
  normalizePortalUf,
  APP_URL,
  type PortalUf,
} from "@/lib/portal";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Search,
  FileText,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Building2,
  TrendingUp,
  BarChart3,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const revalidate = 3600;

interface Props {
  params: Promise<{ uf: string }>;
  searchParams: Promise<{
    q?: string;
    modalidade?: string;
    valor_min?: string;
    valor_max?: string;
    page?: string;
    cidade?: string;
    prazo_dias?: string;
    faixa?: string;
    order_by?: string;
  }>;
}

export async function generateStaticParams() {
  return PORTAL_UFS.map((uf) => ({ uf: uf.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uf: rawUf } = await params;
  const uf = normalizePortalUf(rawUf);
  if (!uf) return { title: "Estado não encontrado | LicitaIA" };

  const stateName = UF_NAMES[uf];

  const countResult = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::TEXT as total FROM licitacoes
     WHERE tenant_id = $1 AND UPPER(uf) = $2 AND slug IS NOT NULL`,
    [PORTAL_PUBLIC_TENANT_ID, uf]
  );
  const total = parseInt(countResult?.total || "0");

  const title = `Licitações em ${stateName} (${uf}) - ${total.toLocaleString("pt-BR")} editais abertos | LicitaIA`;
  const description = `${total.toLocaleString("pt-BR")} licitações abertas em ${stateName}. Pregão eletrônico, dispensa, concorrência. Análise com IA gratuita no LicitaIA.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "LicitaIA",
      url: `${APP_URL}/editais/${uf.toLowerCase()}`,
    },
    alternates: {
      canonical: `${APP_URL}/editais/${uf.toLowerCase()}`,
    },
  };
}

interface UfStats {
  total: string;
  valor_total: string;
  cidades: string;
  modalidades: string;
  analisadas: string;
}

interface LicitacaoRow {
  slug: string;
  orgao_nome: string;
  objeto_compra: string;
  valor_total_estimado: number;
  uf: string;
  municipio: string;
  modalidade_contratacao: string;
  data_publicacao: string;
  data_encerramento_proposta: string;
  analysis_count: number;
  avg_score: number;
}

interface CidadeRow {
  municipio: string;
  count: string;
}

const LIMIT = 20;

export default async function EditaisUfPage({ params, searchParams }: Props) {
  const { uf: rawUf } = await params;
  const normalizedUf = normalizePortalUf(rawUf);
  if (!normalizedUf) notFound();
  const uf: PortalUf = normalizedUf;

  const stateName = UF_NAMES[uf];
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1"));
  const offset = (page - 1) * LIMIT;

  // Value presets
  let effectiveValorMin = sp.valor_min;
  let effectiveValorMax = sp.valor_max;
  if (sp.faixa) {
    const faixas: Record<string, [string?, string?]> = {
      ate50k: [undefined, "50000"],
      "50k-500k": ["50000", "500000"],
      "500k-5m": ["500000", "5000000"],
      acima5m: ["5000000", undefined],
    };
    const f = faixas[sp.faixa];
    if (f) {
      effectiveValorMin = f[0];
      effectiveValorMax = f[1];
    }
  }

  // Build WHERE
  const conditions: string[] = [
    "tenant_id = $1",
    "UPPER(uf) = $2",
    "slug IS NOT NULL",
  ];
  const queryParams: unknown[] = [PORTAL_PUBLIC_TENANT_ID, uf];
  let paramIdx = queryParams.length;

  if (sp.q) {
    paramIdx++;
    conditions.push(
      `to_tsvector('portuguese', COALESCE(objeto_compra, '') || ' ' || COALESCE(orgao_nome, '')) @@ plainto_tsquery('portuguese', $${paramIdx})`
    );
    queryParams.push(sp.q);
  }

  if (sp.cidade) {
    paramIdx++;
    conditions.push(`municipio ILIKE $${paramIdx}`);
    queryParams.push(sp.cidade);
  }

  if (sp.modalidade) {
    paramIdx++;
    conditions.push(`modalidade_contratacao ILIKE $${paramIdx}`);
    queryParams.push(`%${sp.modalidade}%`);
  }

  if (effectiveValorMin) {
    paramIdx++;
    conditions.push(`valor_total_estimado >= $${paramIdx}`);
    queryParams.push(parseFloat(effectiveValorMin));
  }

  if (effectiveValorMax) {
    paramIdx++;
    conditions.push(`valor_total_estimado <= $${paramIdx}`);
    queryParams.push(parseFloat(effectiveValorMax));
  }

  if (sp.prazo_dias) {
    const dias = parseInt(sp.prazo_dias);
    if (dias > 0) {
      conditions.push(
        `data_encerramento_proposta IS NOT NULL AND data_encerramento_proposta >= NOW() AND data_encerramento_proposta <= NOW() + INTERVAL '${dias} days'`
      );
    }
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  // Order by
  const orderOptions: Record<string, string> = {
    recentes: "data_publicacao DESC NULLS LAST",
    valor: "valor_total_estimado DESC NULLS LAST",
    encerramento: "data_encerramento_proposta ASC NULLS LAST",
    analisadas:
      "COALESCE(analysis_count, 0) DESC, data_publicacao DESC NULLS LAST",
  };
  const orderBy = orderOptions[sp.order_by || ""] || orderOptions.recentes;

  // Parallel queries
  const [stats, countResult, licitacoes, cidades] = await Promise.all([
    queryOne<UfStats>(
      `SELECT
        COUNT(*)::TEXT as total,
        COALESCE(SUM(valor_total_estimado), 0)::TEXT as valor_total,
        COUNT(DISTINCT municipio)::TEXT as cidades,
        COUNT(DISTINCT modalidade_contratacao)::TEXT as modalidades,
        COUNT(*) FILTER (WHERE COALESCE(analysis_count, 0) > 0)::TEXT as analisadas
      FROM licitacoes WHERE tenant_id = $1 AND UPPER(uf) = $2 AND slug IS NOT NULL`,
      [PORTAL_PUBLIC_TENANT_ID, uf]
    ),
    queryOne<{ total: string }>(
      `SELECT COUNT(*)::TEXT as total FROM licitacoes ${whereClause}`,
      queryParams
    ),
    query<LicitacaoRow>(
      `SELECT slug, orgao_nome, objeto_compra, valor_total_estimado, uf, municipio,
              modalidade_contratacao, data_publicacao, data_encerramento_proposta,
              COALESCE(analysis_count, 0) as analysis_count, avg_score
       FROM licitacoes
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ${LIMIT} OFFSET ${offset}`,
      queryParams
    ),
    query<CidadeRow>(
      `SELECT municipio, COUNT(*)::TEXT as count
       FROM licitacoes
       WHERE tenant_id = $1 AND UPPER(uf) = $2 AND municipio IS NOT NULL AND slug IS NOT NULL
       GROUP BY municipio
       ORDER BY count DESC
       LIMIT 50`,
      [PORTAL_PUBLIC_TENANT_ID, uf]
    ),
  ]);

  const total = parseInt(countResult?.total || "0");
  const totalPages = Math.ceil(total / LIMIT);
  const totalUf = parseInt(stats?.total || "0");

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = {
      q: sp.q,
      cidade: sp.cidade,
      modalidade: sp.modalidade,
      valor_min: sp.valor_min,
      valor_max: sp.valor_max,
      prazo_dias: sp.prazo_dias,
      faixa: sp.faixa,
      order_by: sp.order_by,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/editais/${uf.toLowerCase()}${qs ? `?${qs}` : ""}`;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Licitações em ${stateName} (${uf})`,
    description: `${totalUf} licitações abertas em ${stateName}. Portal público com análise de IA.`,
    url: `${APP_URL}/editais/${uf.toLowerCase()}`,
    provider: {
      "@type": "Organization",
      name: "LicitaIA",
      url: APP_URL,
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "LicitaIA",
          item: APP_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Editais",
          item: `${APP_URL}/editais`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: stateName,
          item: `${APP_URL}/editais/${uf.toLowerCase()}`,
        },
      ],
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
        <nav className="mb-6 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-white transition-colors">
            LicitaIA
          </Link>
          <span>/</span>
          <Link
            href="/editais"
            className="hover:text-white transition-colors"
          >
            Editais
          </Link>
          <span>/</span>
          <span className="text-slate-300">{stateName}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-indigo-400" />
            Licitações Abertas em {stateName}
          </h1>
          <p className="text-sm text-slate-500">
            {totalUf.toLocaleString("pt-BR")} editais encontrados no estado
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-indigo-400" />
              <span className="text-xs text-slate-500">Total</span>
            </div>
            <p className="text-lg font-bold text-white">
              {parseInt(stats?.total || "0").toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-slate-500">Valor total</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">
              {formatCurrency(parseFloat(stats?.valor_total || "0"))}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-slate-500">Cidades</span>
            </div>
            <p className="text-lg font-bold text-white">
              {parseInt(stats?.cidades || "0").toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-indigo-400" />
              <span className="text-xs text-slate-500">Analisadas IA</span>
            </div>
            <p className="text-lg font-bold text-indigo-400">
              {parseInt(stats?.analisadas || "0").toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Filters */}
        <form
          action={`/editais/${uf.toLowerCase()}`}
          method="GET"
          className="mb-8"
        >
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                name="q"
                defaultValue={sp.q}
                placeholder="Buscar por objeto ou órgão..."
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>
            <select
              name="cidade"
              defaultValue={sp.cidade || ""}
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c.municipio} value={c.municipio}>
                  {c.municipio} ({c.count})
                </option>
              ))}
            </select>
            <select
              name="order_by"
              defaultValue={sp.order_by || ""}
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Mais recentes</option>
              <option value="valor">Maior valor</option>
              <option value="encerramento">Encerrando em breve</option>
              <option value="analisadas">Mais analisadas</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Filtrar
            </button>
          </div>

          {/* Advanced filters */}
          <div className="mt-3 flex gap-3 flex-wrap items-center">
            <input
              type="text"
              name="modalidade"
              defaultValue={sp.modalidade}
              placeholder="Modalidade..."
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none w-36"
            />
            <select
              name="prazo_dias"
              defaultValue={sp.prazo_dias || ""}
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Qualquer prazo</option>
              <option value="7">Encerra em 7 dias</option>
              <option value="30">Encerra em 30 dias</option>
            </select>
          </div>

          {/* Value presets */}
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <span className="text-xs text-slate-500">Faixa de valor:</span>
            {[
              { key: "ate50k", label: "Até R$50k" },
              { key: "50k-500k", label: "R$50k-500k" },
              { key: "500k-5m", label: "R$500k-5M" },
              { key: "acima5m", label: "Acima R$5M" },
            ].map((f) => (
              <Link
                key={f.key}
                href={buildUrl({
                  faixa: sp.faixa === f.key ? undefined : f.key,
                  valor_min: undefined,
                  valor_max: undefined,
                  page: undefined,
                })}
                className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                  sp.faixa === f.key
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                    : "border-slate-700/60 text-slate-400 hover:border-indigo-500/50 hover:text-white"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>

          {/* Active filters */}
          {(sp.q || sp.cidade || sp.modalidade || sp.faixa || sp.prazo_dias) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Filtros:</span>
              {sp.q && (
                <Link href={buildUrl({ q: undefined, page: undefined })}>
                  <Badge
                    variant="outline"
                    className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer"
                  >
                    &ldquo;{sp.q}&rdquo; ×
                  </Badge>
                </Link>
              )}
              {sp.cidade && (
                <Link href={buildUrl({ cidade: undefined, page: undefined })}>
                  <Badge
                    variant="outline"
                    className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer"
                  >
                    {sp.cidade} ×
                  </Badge>
                </Link>
              )}
              {sp.modalidade && (
                <Link
                  href={buildUrl({ modalidade: undefined, page: undefined })}
                >
                  <Badge
                    variant="outline"
                    className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer"
                  >
                    {sp.modalidade} ×
                  </Badge>
                </Link>
              )}
              {sp.faixa && (
                <Link href={buildUrl({ faixa: undefined, page: undefined })}>
                  <Badge
                    variant="outline"
                    className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer"
                  >
                    Faixa: {sp.faixa} ×
                  </Badge>
                </Link>
              )}
              {sp.prazo_dias && (
                <Link
                  href={buildUrl({ prazo_dias: undefined, page: undefined })}
                >
                  <Badge
                    variant="outline"
                    className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer"
                  >
                    Encerra em {sp.prazo_dias}d ×
                  </Badge>
                </Link>
              )}
              <Link
                href={`/editais/${uf.toLowerCase()}`}
                className="text-xs text-slate-600 hover:text-red-400 ml-2"
              >
                Limpar tudo
              </Link>
            </div>
          )}
        </form>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-500 mb-4">
              {total.toLocaleString("pt-BR")} resultado
              {total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
            </p>

            {licitacoes.length === 0 ? (
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-700 mb-3" />
                <p className="text-slate-400">
                  Nenhuma licitação encontrada em {stateName} com esses filtros.
                </p>
                <Link
                  href={`/editais/${uf.toLowerCase()}`}
                  className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
                >
                  Limpar filtros
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
                              {lic.analysis_count} empresas
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-2 group-hover:text-white transition-colors">
                          {lic.objeto_compra}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-600 truncate">
                          {lic.orgao_nome}
                          {lic.municipio && ` • ${lic.municipio}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-400">
                          {lic.valor_total_estimado
                            ? formatCurrency(lic.valor_total_estimado)
                            : "—"}
                        </p>
                        {lic.data_publicacao && (
                          <p className="text-xs text-slate-600 mt-1">
                            {new Date(lic.data_publicacao).toLocaleDateString(
                              "pt-BR"
                            )}
                          </p>
                        )}
                        {lic.data_encerramento_proposta && (
                          <p className="text-xs text-slate-600">
                            Encerra:{" "}
                            {new Date(
                              lic.data_encerramento_proposta
                            ).toLocaleDateString("pt-BR")}
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
                    href={buildUrl({ page: String(page - 1) })}
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
                      href={buildUrl({ page: String(pageNum) })}
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
                    href={buildUrl({ page: String(page + 1) })}
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
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-72 shrink-0 space-y-6">
            {/* Lead form */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5">
              <h3 className="text-sm font-semibold text-white mb-2">
                Quer receber alertas de {stateName}?
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Cadastre-se e receba as melhores oportunidades de licitação com
                análise de IA.
              </p>
              <Link
                href="/onboarding"
                className="block w-full rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Começar grátis
              </Link>
            </div>

            {/* Other states */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5">
              <h3 className="text-sm font-semibold text-white mb-3">
                Outros estados
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {PORTAL_UFS.filter((u) => u !== uf).map((u) => (
                  <Link
                    key={u}
                    href={`/editais/${u.toLowerCase()}`}
                    className="rounded-md border border-slate-700/40 px-2 py-1 text-xs text-slate-400 hover:border-indigo-500/50 hover:text-white transition-colors"
                  >
                    {u}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

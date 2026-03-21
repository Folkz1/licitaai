import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID, UF_NAMES, type PortalUf } from "@/lib/portal";
import { SegmentIcon } from "@/lib/segment-icons";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Zap,
  MapPin,
  ChevronRight,
  Home,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache 1 hour

interface Segmento {
  id: number;
  slug: string;
  nome: string;
  descricao: string | null;
  keywords: string[];
  icone: string | null;
}

interface UfStat {
  uf: string;
  total: string;
  valor: string;
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
  params: Promise<{ segmento: string }>;
}

async function getSegmento(slug: string): Promise<Segmento | null> {
  return queryOne<Segmento>(
    `SELECT id, slug, nome, descricao, keywords, icone FROM segmentos WHERE slug = $1`,
    [slug]
  );
}

function buildKeywordFilter(): string {
  // Use full-text search (uses GIN index, 100x faster than ILIKE)
  return `to_tsvector('portuguese', COALESCE(l.objeto_compra, '')) @@ to_tsquery('portuguese', array_to_string(s.keywords, ' | '))`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segmento: segSlug } = await params;
  const seg = await getSegmento(segSlug);
  if (!seg) return { title: "Segmento não encontrado | LicitaIA" };

  const title = `Licitações de ${seg.nome} | LicitaIA`;
  const description = `Encontre licitações de ${seg.nome.toLowerCase()} no PNCP. ${seg.descricao || ""} Dados públicos atualizados diariamente.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${APP_URL}/fornecedores/${seg.slug}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "LicitaIA",
      url: `${APP_URL}/fornecedores/${seg.slug}`,
    },
  };
}

export default async function SegmentoPage({ params }: Props) {
  const { segmento: segSlug } = await params;
  const seg = await getSegmento(segSlug);
  if (!seg) notFound();

  // Get UF stats for this segment
  const ufStats = await query<UfStat>(
    `SELECT l.uf, COUNT(*)::TEXT as total, COALESCE(SUM(l.valor_total_estimado), 0)::TEXT as valor
     FROM licitacoes l, segmentos s
     WHERE s.slug = $1 AND l.tenant_id = $2
       AND l.uf IS NOT NULL
       AND ${buildKeywordFilter()}
     GROUP BY l.uf
     ORDER BY COUNT(*) DESC`,
    [seg.slug, PORTAL_PUBLIC_TENANT_ID]
  );

  // Get recent licitacoes
  const licitacoes = await query<Licitacao>(
    `SELECT l.slug, l.objeto_compra, l.orgao_nome, l.uf, l.municipio,
            l.valor_total_estimado, l.data_publicacao, l.modalidade_contratacao,
            l.data_encerramento_proposta,
            COALESCE(l.analysis_count, 0) as analysis_count, l.avg_score
     FROM licitacoes l, segmentos s
     WHERE s.slug = $1 AND l.tenant_id = $2 AND l.slug IS NOT NULL
       AND ${buildKeywordFilter()}
     ORDER BY l.data_publicacao DESC NULLS LAST
     LIMIT 20`,
    [seg.slug, PORTAL_PUBLIC_TENANT_ID]
  );

  const totalLicitacoes = ufStats.reduce((sum, u) => sum + parseInt(u.total, 10), 0);
  const valorTotal = ufStats.reduce((sum, u) => sum + parseFloat(u.valor), 0);

  function formatCompactValue(v: number) {
    if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return formatCurrency(v);
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
          <span className="text-slate-300">{seg.nome}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden py-12 sm:py-16">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/10 via-slate-950 to-slate-950" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <SegmentIcon name={seg.icone} className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Licitações de {seg.nome}
            </span>
          </h1>
          {seg.descricao && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
              {seg.descricao}
            </p>
          )}

          {/* Stats */}
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-6">
            <div>
              <p className="text-2xl font-bold text-white">
                {totalLicitacoes.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-xs text-slate-500">Licitações encontradas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCompactValue(valorTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Valor total estimado</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-400">
                {ufStats.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">Estados com editais</p>
            </div>
          </div>

          {/* Keywords */}
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            {seg.keywords.map((kw) => (
              <Badge
                key={kw}
                variant="outline"
                className="border-slate-700/60 text-xs text-slate-400"
              >
                {kw}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* UF Grid */}
      {ufStats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-400">
              Por estado
            </h2>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            {ufStats.map((u) => {
              const ufName = UF_NAMES[u.uf as PortalUf] || u.uf;
              return (
                <Link
                  key={u.uf}
                  href={`/fornecedores/${seg.slug}/${u.uf.toLowerCase()}`}
                  className="group rounded-lg border border-slate-800/60 bg-slate-900/50 p-3 transition-all hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{u.uf}</span>
                    <span className="text-xs text-slate-600">{parseInt(u.total, 10).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{ufName}</p>
                  <p className="mt-1 text-xs font-medium text-emerald-400/80">
                    {formatCompactValue(parseFloat(u.valor))}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent licitacoes */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Últimas licitações de {seg.nome}
          </h2>
          <Link
            href={`/editais?q=${encodeURIComponent(seg.keywords[0] || seg.nome)}`}
            className="flex items-center gap-1 text-sm text-indigo-400 transition-colors hover:text-indigo-300"
          >
            Buscar mais <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {licitacoes.length === 0 ? (
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-12 text-center">
            <p className="text-slate-400">
              Nenhuma licitação encontrada para este segmento ainda.
            </p>
            <Link
              href="/editais"
              className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
            >
              Buscar no portal completo
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
                      {lic.uf && (
                        <Badge
                          variant="outline"
                          className="text-xs border-slate-700 text-slate-400 shrink-0"
                        >
                          {lic.uf}
                        </Badge>
                      )}
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
                          IA{" "}
                          {lic.avg_score != null
                            ? `${Number(lic.avg_score).toFixed(0)}/10`
                            : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2 group-hover:text-white transition-colors">
                      {lic.objeto_compra}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-600 truncate">
                      {lic.orgao_nome}
                      {lic.municipio && ` - ${lic.municipio}`}
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
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-indigo-950/20 py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-xl font-bold text-white">
            Monitore licitações de {seg.nome} automaticamente
          </h2>
          <p className="mt-3 text-slate-400">
            Receba alertas por WhatsApp quando novas licitações do seu segmento
            forem publicadas no PNCP. 7 dias grátis.
          </p>
          <div className="mt-6">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-base font-semibold text-slate-950 transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              <Zap className="h-5 w-5" />
              Configurar alertas
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID } from "@/lib/portal";
import { Metadata } from "next";
import Link from "next/link";
import { Search, FileText, ArrowLeft, ArrowRight, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";
import LiveStats from "@/components/portal/LiveStats";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    uf?: string;
    modalidade?: string;
    valor_min?: string;
    valor_max?: string;
    page?: string;
    data_inicio?: string;
    data_fim?: string;
    tem_analise?: string;
    prazo_dias?: string;
    faixa?: string;
    order_by?: string;
  }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const parts = ["Editais de Licitação"];
  if (sp.uf) parts.push(sp.uf);
  if (sp.q) parts.push(`"${sp.q}"`);
  const title = `${parts.join(" - ")} | LicitaIA`;
  // Canonical always points to the base URL without search params to avoid duplicate content
  const canonicalUrl = `${APP_URL}/editais`;
  return {
    title,
    description: `Busque editais de licitação do PNCP${sp.uf ? ` em ${sp.uf}` : ""}${sp.q ? ` sobre ${sp.q}` : ""}. Análise com IA disponível.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: { title, type: "website", siteName: "LicitaIA", url: canonicalUrl },
  };
}

const LIMIT = 20;

export default async function EditaisListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1"));
  const offset = (page - 1) * LIMIT;

  // Value presets
  let effectiveValorMin = sp.valor_min;
  let effectiveValorMax = sp.valor_max;
  if (sp.faixa) {
    const faixas: Record<string, [string?, string?]> = {
      "ate50k": [undefined, "50000"],
      "50k-500k": ["50000", "500000"],
      "500k-5m": ["500000", "5000000"],
      "acima5m": ["5000000", undefined],
    };
    const f = faixas[sp.faixa];
    if (f) {
      effectiveValorMin = f[0];
      effectiveValorMax = f[1];
    }
  }

  // Build WHERE clauses
  const conditions: string[] = ["tenant_id = $1", "slug IS NOT NULL"];
  const params: unknown[] = [PORTAL_PUBLIC_TENANT_ID];
  let paramIdx = params.length;

  if (sp.q) {
    paramIdx++;
    conditions.push(
      `to_tsvector('portuguese', COALESCE(objeto_compra, '') || ' ' || COALESCE(orgao_nome, '')) @@ plainto_tsquery('portuguese', $${paramIdx})`
    );
    params.push(sp.q);
  }

  if (sp.uf) {
    paramIdx++;
    conditions.push(`uf = $${paramIdx}`);
    params.push(sp.uf);
  }

  if (sp.modalidade) {
    paramIdx++;
    conditions.push(`modalidade_contratacao ILIKE $${paramIdx}`);
    params.push(`%${sp.modalidade}%`);
  }

  if (effectiveValorMin) {
    paramIdx++;
    conditions.push(`valor_total_estimado >= $${paramIdx}`);
    params.push(parseFloat(effectiveValorMin));
  }

  if (effectiveValorMax) {
    paramIdx++;
    conditions.push(`valor_total_estimado <= $${paramIdx}`);
    params.push(parseFloat(effectiveValorMax));
  }

  if (sp.data_inicio) {
    paramIdx++;
    conditions.push(`data_publicacao >= $${paramIdx}`);
    params.push(sp.data_inicio);
  }

  if (sp.data_fim) {
    paramIdx++;
    conditions.push(`data_publicacao <= $${paramIdx}`);
    params.push(sp.data_fim);
  }

  if (sp.tem_analise === "sim") {
    conditions.push(`COALESCE(analysis_count, 0) > 0`);
  }

  if (sp.prazo_dias) {
    const dias = parseInt(sp.prazo_dias);
    if (dias > 0) {
      conditions.push(`data_encerramento_proposta IS NOT NULL AND data_encerramento_proposta >= NOW() AND data_encerramento_proposta <= NOW() + INTERVAL '${dias} days'`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Order by
  const orderOptions: Record<string, string> = {
    recentes: "data_publicacao DESC NULLS LAST",
    valor: "valor_total_estimado DESC NULLS LAST",
    encerramento: "data_encerramento_proposta ASC NULLS LAST",
    analisadas: "COALESCE(analysis_count, 0) DESC, data_publicacao DESC NULLS LAST",
  };
  const orderBy = orderOptions[sp.order_by || ""] || orderOptions.recentes;

  // Count total
  const countResult = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::TEXT as total FROM licitacoes ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.total || "0");
  const totalPages = Math.ceil(total / LIMIT);

  // Fetch results
  const licitacoes = await query<{
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
  }>(
    `SELECT slug, orgao_nome, objeto_compra, valor_total_estimado, uf, municipio,
            modalidade_contratacao, data_publicacao, data_encerramento_proposta,
            COALESCE(analysis_count, 0) as analysis_count, avg_score
     FROM licitacoes
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ${LIMIT} OFFSET ${offset}`,
    params
  );

  // UFs for filter
  const ufs = await query<{ uf: string; count: string }>(
    `SELECT uf, COUNT(*)::TEXT as count
     FROM licitacoes
     WHERE tenant_id = $1 AND uf IS NOT NULL
     GROUP BY uf
     ORDER BY COUNT(*) DESC
     LIMIT 27`,
    [PORTAL_PUBLIC_TENANT_ID]
  );

  // Build URL helper
  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = {
      q: sp.q, uf: sp.uf, modalidade: sp.modalidade, valor_min: sp.valor_min, valor_max: sp.valor_max,
      data_inicio: sp.data_inicio, data_fim: sp.data_fim, tem_analise: sp.tem_analise,
      prazo_dias: sp.prazo_dias, faixa: sp.faixa, order_by: sp.order_by,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `/editais?${p.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Live Stats */}
      <div className="mb-6">
        <Suspense fallback={null}>
          <LiveStats />
        </Suspense>
      </div>

      {/* Search + Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Editais de Licitação</h1>
        <p className="text-sm text-slate-500">
          {total.toLocaleString("pt-BR")} resultado{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          {sp.q && <> para <span className="text-indigo-400">&ldquo;{sp.q}&rdquo;</span></>}
          {sp.uf && <> em <span className="text-indigo-400">{sp.uf}</span></>}
        </p>

        <form action="/editais" method="GET" className="mt-4">
          {/* Row 1: Search + UF + Submit */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
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
              name="uf"
              defaultValue={sp.uf || ""}
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Todos os estados</option>
              {ufs.map((u) => (
                <option key={u.uf} value={u.uf}>
                  {u.uf} ({u.count})
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
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtrar
            </button>
          </div>

          {/* Row 2: Advanced filters */}
          <div className="mt-3 flex gap-3 flex-wrap items-center">
            <input
              type="text"
              name="modalidade"
              defaultValue={sp.modalidade}
              placeholder="Modalidade..."
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none w-36"
            />
            <input
              type="date"
              name="data_inicio"
              defaultValue={sp.data_inicio}
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-xs text-slate-600">a</span>
            <input
              type="date"
              name="data_fim"
              defaultValue={sp.data_fim}
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
            />
            <select
              name="tem_analise"
              defaultValue={sp.tem_analise || ""}
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Todas</option>
              <option value="sim">Com análise IA</option>
            </select>
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

          {/* Row 3: Value range presets */}
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
                href={buildUrl({ faixa: sp.faixa === f.key ? undefined : f.key, valor_min: undefined, valor_max: undefined, page: undefined })}
                className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                  sp.faixa === f.key
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                    : "border-slate-700/60 text-slate-400 hover:border-indigo-500/50 hover:text-white"
                }`}
              >
                {f.label}
              </Link>
            ))}
            {!sp.faixa && (
              <>
                <input
                  type="number"
                  name="valor_min"
                  defaultValue={sp.valor_min}
                  placeholder="Valor mín."
                  className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none w-28"
                />
                <input
                  type="number"
                  name="valor_max"
                  defaultValue={sp.valor_max}
                  placeholder="Valor máx."
                  className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none w-28"
                />
              </>
            )}
          </div>

          {/* Active filters */}
          {(sp.q || sp.uf || sp.modalidade || sp.valor_min || sp.valor_max || sp.faixa || sp.tem_analise || sp.prazo_dias || sp.data_inicio) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Filtros:</span>
              {sp.q && (
                <Link href={buildUrl({ q: undefined, page: undefined })}>
                  <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer">
                    &ldquo;{sp.q}&rdquo; ×
                  </Badge>
                </Link>
              )}
              {sp.uf && (
                <Link href={buildUrl({ uf: undefined, page: undefined })}>
                  <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer">
                    {sp.uf} ×
                  </Badge>
                </Link>
              )}
              {sp.modalidade && (
                <Link href={buildUrl({ modalidade: undefined, page: undefined })}>
                  <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer">
                    {sp.modalidade} ×
                  </Badge>
                </Link>
              )}
              {sp.faixa && (
                <Link href={buildUrl({ faixa: undefined, page: undefined })}>
                  <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer">
                    Faixa: {sp.faixa} ×
                  </Badge>
                </Link>
              )}
              {sp.tem_analise && (
                <Link href={buildUrl({ tem_analise: undefined, page: undefined })}>
                  <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer">
                    Com análise IA ×
                  </Badge>
                </Link>
              )}
              {sp.prazo_dias && (
                <Link href={buildUrl({ prazo_dias: undefined, page: undefined })}>
                  <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer">
                    Encerra em {sp.prazo_dias}d ×
                  </Badge>
                </Link>
              )}
              {sp.data_inicio && (
                <Link href={buildUrl({ data_inicio: undefined, data_fim: undefined, page: undefined })}>
                  <Badge variant="outline" className="text-xs border-indigo-500/30 text-indigo-400 hover:border-red-500/50 cursor-pointer">
                    Período: {sp.data_inicio}{sp.data_fim ? ` a ${sp.data_fim}` : ""} ×
                  </Badge>
                </Link>
              )}
              <Link href="/editais" className="text-xs text-slate-600 hover:text-red-400 ml-2">
                Limpar tudo
              </Link>
            </div>
          )}
        </form>
      </div>

      {/* Results */}
      {licitacoes.length === 0 ? (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-700 mb-3" />
          <p className="text-slate-400">Nenhuma licitação encontrada com esses filtros.</p>
          <Link href="/editais" className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
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
                    {lic.uf && (
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 shrink-0">
                        {lic.uf}
                      </Badge>
                    )}
                    {lic.modalidade_contratacao && (
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-500 truncate max-w-[200px]">
                        {lic.modalidade_contratacao}
                      </Badge>
                    )}
                    {lic.analysis_count > 0 && (
                      <Badge className="text-xs bg-indigo-500/15 text-indigo-400 border-indigo-500/20">
                        <Sparkles className="mr-1 h-3 w-3" />
                        IA {lic.avg_score != null ? `${Number(lic.avg_score).toFixed(0)}/10` : ""}
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
                    {lic.municipio && ` • ${lic.municipio}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-400">
                    {lic.valor_total_estimado ? formatCurrency(lic.valor_total_estimado) : "—"}
                  </p>
                  {lic.data_publicacao && (
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(lic.data_publicacao).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  {lic.data_encerramento_proposta && (
                    <p className="text-xs text-slate-600">
                      Encerra: {new Date(lic.data_encerramento_proposta).toLocaleDateString("pt-BR")}
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
  );
}

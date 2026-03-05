import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { Metadata } from "next";
import Link from "next/link";
import { Search, FileText, ArrowLeft, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    q?: string;
    uf?: string;
    modalidade?: string;
    valor_min?: string;
    valor_max?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const parts = ["Editais de Licitação"];
  if (sp.uf) parts.push(sp.uf);
  if (sp.q) parts.push(`"${sp.q}"`);
  const title = `${parts.join(" - ")} | LicitaIA`;
  return {
    title,
    description: `Busque editais de licitação do PNCP${sp.uf ? ` em ${sp.uf}` : ""}${sp.q ? ` sobre ${sp.q}` : ""}. Análise com IA disponível.`,
    openGraph: { title, type: "website", siteName: "LicitaIA" },
  };
}

const LIMIT = 20;

export default async function EditaisListPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1"));
  const offset = (page - 1) * LIMIT;

  // Build WHERE clauses
  const conditions: string[] = ["slug IS NOT NULL"];
  const params: unknown[] = [];
  let paramIdx = 0;

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

  if (sp.valor_min) {
    paramIdx++;
    conditions.push(`valor_total_estimado >= $${paramIdx}`);
    params.push(parseFloat(sp.valor_min));
  }

  if (sp.valor_max) {
    paramIdx++;
    conditions.push(`valor_total_estimado <= $${paramIdx}`);
    params.push(parseFloat(sp.valor_max));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
  }>(
    `SELECT slug, orgao_nome, objeto_compra, valor_total_estimado, uf, municipio,
            modalidade_contratacao, data_publicacao, data_encerramento_proposta
     FROM licitacoes
     ${whereClause}
     ORDER BY data_publicacao DESC NULLS LAST
     LIMIT ${LIMIT} OFFSET ${offset}`,
    params
  );

  // UFs for filter
  const ufs = await query<{ uf: string; count: string }>(
    `SELECT uf, COUNT(*)::TEXT as count FROM licitacoes WHERE uf IS NOT NULL GROUP BY uf ORDER BY count DESC LIMIT 27`
  );

  // Build URL helper
  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { q: sp.q, uf: sp.uf, modalidade: sp.modalidade, valor_min: sp.valor_min, valor_max: sp.valor_max, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `/editais?${p.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search + Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Editais de Licitação</h1>
        <p className="text-sm text-slate-500">
          {total.toLocaleString("pt-BR")} resultado{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          {sp.q && <> para <span className="text-indigo-400">&ldquo;{sp.q}&rdquo;</span></>}
          {sp.uf && <> em <span className="text-indigo-400">{sp.uf}</span></>}
        </p>

        <form action="/editais" method="GET" className="mt-4">
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
            <input
              type="text"
              name="modalidade"
              defaultValue={sp.modalidade}
              placeholder="Modalidade..."
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none w-40"
            />
            <input
              type="number"
              name="valor_min"
              defaultValue={sp.valor_min}
              placeholder="Valor mín."
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none w-32"
            />
            <input
              type="number"
              name="valor_max"
              defaultValue={sp.valor_max}
              placeholder="Valor máx."
              className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none w-32"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtrar
            </button>
          </div>
          {/* Active filters */}
          {(sp.q || sp.uf || sp.modalidade || sp.valor_min || sp.valor_max) && (
            <div className="mt-3 flex items-center gap-2">
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
                  <div className="flex items-center gap-2 mb-2">
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

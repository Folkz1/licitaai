import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { Metadata } from "next";
import Link from "next/link";
import { Search, FileText, MapPin, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LicitaIA - Busca Inteligente de Licitações Públicas",
  description:
    "Encontre e analise licitações públicas do PNCP com inteligência artificial. Busca por estado, modalidade e valor. Análise automática de editais.",
  openGraph: {
    title: "LicitaIA - Busca Inteligente de Licitações Públicas",
    description:
      "Encontre e analise licitações públicas do PNCP com inteligência artificial.",
    type: "website",
    siteName: "LicitaIA",
  },
};

export default async function PortalHomePage() {
  const stats = await queryOne<{
    total: string;
    ufs: string;
    valor_total: string;
    analisadas: string;
    tenants_ativos: string;
    ultima_atualizacao: string;
  }>(
    `SELECT
      COUNT(*)::TEXT as total,
      COUNT(DISTINCT uf)::TEXT as ufs,
      COALESCE(SUM(valor_total_estimado), 0)::TEXT as valor_total,
      COUNT(*) FILTER (WHERE COALESCE(analysis_count, 0) > 0)::TEXT as analisadas,
      (SELECT COUNT(DISTINCT tenant_id)::TEXT FROM licitacoes WHERE tenant_id IS NOT NULL) as tenants_ativos,
      TO_CHAR(MAX(created_at), 'DD/MM HH24:MI') as ultima_atualizacao
    FROM licitacoes`
  );

  const recentes = await query<{
    slug: string;
    orgao_nome: string;
    objeto_compra: string;
    valor_total_estimado: number;
    uf: string;
    modalidade_contratacao: string;
    data_publicacao: string;
  }>(
    `SELECT slug, orgao_nome, objeto_compra, valor_total_estimado, uf, modalidade_contratacao, data_publicacao
     FROM licitacoes
     WHERE slug IS NOT NULL
     ORDER BY data_publicacao DESC NULLS LAST
     LIMIT 12`
  );

  const ufs = await query<{ uf: string; count: string }>(
    `SELECT uf, COUNT(*)::TEXT as count
     FROM licitacoes
     WHERE uf IS NOT NULL
     GROUP BY uf
     ORDER BY count DESC
     LIMIT 20`
  );

  const totalNum = parseInt(stats?.total || "0");
  const ufsNum = parseInt(stats?.ufs || "0");
  const valorTotal = parseFloat(stats?.valor_total || "0");
  const analisadasNum = parseInt(stats?.analisadas || "0");
  const tenantsNum = parseInt(stats?.tenants_ativos || "0");
  const ultimaAtualizacao = stats?.ultima_atualizacao || "";

  function formatCompactValue(v: number) {
    if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return formatCurrency(v);
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Badge className="mb-6 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Dados do PNCP atualizados diariamente{ultimaAtualizacao ? ` (último: ${ultimaAtualizacao})` : ""}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Busca Inteligente de{" "}
            </span>
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Licitações Públicas
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
            Encontre oportunidades de licitação em todo o Brasil. Busca avançada com
            análise automática por inteligência artificial.
          </p>

          {/* Search Bar */}
          <form action="/editais" method="GET" className="mt-10">
            <div className="relative mx-auto max-w-2xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                name="q"
                placeholder="Buscar licitações... (ex: tecnologia da informação, material hospitalar)"
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 py-4 pl-12 pr-32 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Buscar
              </button>
            </div>
          </form>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto sm:grid-cols-5">
            <div>
              <p className="text-2xl font-bold text-white sm:text-3xl">
                {totalNum.toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-slate-500 mt-1">Licitações</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white sm:text-3xl">{ufsNum}</p>
              <p className="text-xs text-slate-500 mt-1">Estados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400 sm:text-3xl">
                {formatCompactValue(valorTotal)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Valor Total</p>
            </div>
            {analisadasNum > 0 && (
              <div>
                <p className="text-2xl font-bold text-indigo-400 sm:text-3xl">
                  {analisadasNum.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-slate-500 mt-1">Analisadas por IA</p>
              </div>
            )}
            {tenantsNum > 0 && (
              <div>
                <p className="text-2xl font-bold text-amber-400 sm:text-3xl">
                  {tenantsNum}
                </p>
                <p className="text-xs text-slate-500 mt-1">Empresas usando</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* UF Filters */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-400">Filtrar por Estado</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {ufs.map((u) => (
            <Link
              key={u.uf}
              href={`/editais?uf=${u.uf}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-300 hover:border-indigo-500/50 hover:text-white transition-colors"
            >
              {u.uf}
              <span className="text-xs text-slate-600">{u.count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest Licitações */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Últimas Publicações</h2>
          </div>
          <Link
            href="/editais"
            className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentes.map((lic) => (
            <Link
              key={lic.slug}
              href={`/editais/${lic.slug}`}
              className="group rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                {lic.uf && (
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    {lic.uf}
                  </Badge>
                )}
                {lic.modalidade_contratacao && (
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-500 truncate max-w-[160px]">
                    {lic.modalidade_contratacao}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-300 line-clamp-2 group-hover:text-white transition-colors leading-relaxed">
                {lic.objeto_compra}
              </p>
              <p className="mt-2 text-xs text-slate-600 truncate">{lic.orgao_nome}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-400">
                  {lic.valor_total_estimado ? formatCurrency(lic.valor_total_estimado) : "—"}
                </span>
                {lic.data_publicacao && (
                  <span className="text-xs text-slate-600">
                    {new Date(lic.data_publicacao).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-indigo-950/20 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <FileText className="mx-auto h-10 w-10 text-indigo-400 mb-4" />
          <h2 className="text-2xl font-bold text-white">
            Análise completa com Inteligência Artificial
          </h2>
          <p className="mt-3 text-slate-400">
            Receba análise automática de editais, classificação por prioridade, identificação de
            requisitos e riscos. Tudo com IA.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Começar agora — é grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

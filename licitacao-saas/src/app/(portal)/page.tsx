import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { PORTAL_PUBLIC_TENANT_ID } from "@/lib/portal";
import { COMMERCIAL_MESSAGES } from "@/lib/commercial";
import { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  FileText,
  MapPin,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LicitaIA - Busca Inteligente de Licitacoes Publicas",
  description:
    "Encontre e analise licitacoes publicas do PNCP com inteligencia artificial. Busca por estado, modalidade e valor.",
  openGraph: {
    title: "LicitaIA - Busca Inteligente de Licitacoes Publicas",
    description:
      "Encontre e analise licitacoes publicas do PNCP com inteligencia artificial.",
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
      (SELECT COUNT(DISTINCT tenant_id)::TEXT FROM subscriptions WHERE status = 'ACTIVE') as tenants_ativos,
      TO_CHAR(MAX(created_at), 'DD/MM HH24:MI') as ultima_atualizacao
    FROM licitacoes
    WHERE tenant_id = $1`,
    [PORTAL_PUBLIC_TENANT_ID]
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
     WHERE tenant_id = $1 AND slug IS NOT NULL
     ORDER BY data_publicacao DESC NULLS LAST
     LIMIT 12`,
    [PORTAL_PUBLIC_TENANT_ID]
  );

  const ufs = await query<{ uf: string; count: string }>(
    `SELECT uf, COUNT(*)::TEXT as count
     FROM licitacoes
     WHERE tenant_id = $1 AND uf IS NOT NULL
     GROUP BY uf
     ORDER BY COUNT(*) DESC
     LIMIT 20`,
    [PORTAL_PUBLIC_TENANT_ID]
  );

  const totalNum = parseInt(stats?.total || "0", 10);
  const ufsNum = parseInt(stats?.ufs || "0", 10);
  const valorTotal = parseFloat(stats?.valor_total || "0");
  const analisadasNum = parseInt(stats?.analisadas || "0", 10);
  const tenantsNum = parseInt(stats?.tenants_ativos || "0", 10);
  const ultimaAtualizacao = stats?.ultima_atualizacao || "";

  function formatCompactValue(v: number) {
    if (v >= 1_000_000_000) {
      return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
    }
    if (v >= 1_000_000) {
      return `R$ ${(v / 1_000_000).toFixed(0)}M`;
    }
    if (v >= 1_000) {
      return `R$ ${(v / 1_000).toFixed(0)}K`;
    }
    return formatCurrency(v);
  }

  return (
    <div>
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Badge className="mb-6 border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/10">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Dados do PNCP atualizados diariamente
            {ultimaAtualizacao ? ` (ultimo: ${ultimaAtualizacao})` : ""}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Radar de licitacoes com IA
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Encontre oportunidades do PNCP, filtre o que faz sentido para o seu
            segmento e fale conosco para configurar um radar assistido para a sua
            operacao.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={COMMERCIAL_MESSAGES.home}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Agendar diagnostico no WhatsApp
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/precos"
              className="inline-flex items-center rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              Ver oferta assistida
            </Link>
          </div>

          <form action="/editais" method="GET" className="mt-10">
            <div className="relative mx-auto max-w-2xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                name="q"
                placeholder="Buscar licitacoes... (ex: tecnologia da informacao, material hospitalar)"
                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 py-4 pl-12 pr-32 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Buscar
              </button>
            </div>
          </form>

          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-6 sm:grid-cols-5">
            <Stat label="Licitacoes" value={totalNum.toLocaleString("pt-BR")} />
            <Stat label="Estados" value={ufsNum.toString()} />
            <Stat label="Valor Total" value={formatCompactValue(valorTotal)} accent="text-emerald-400" />
            {analisadasNum > 0 && (
              <Stat
                label="Analisadas por IA"
                value={analisadasNum.toLocaleString("pt-BR")}
                accent="text-indigo-400"
              />
            )}
            {tenantsNum > 0 && (
              <Stat
                label="Empresas usando"
                value={tenantsNum.toString()}
                accent="text-amber-400"
              />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-400">Explorar por estado</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {ufs.map((u) => (
            <Link
              key={u.uf}
              href={`/editais?uf=${u.uf}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-indigo-500/50 hover:text-white"
            >
              {u.uf}
              <span className="text-xs text-slate-600">{u.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Ultimas publicacoes</h2>
          </div>
          <Link
            href="/editais"
            className="flex items-center gap-1 text-sm text-indigo-400 transition-colors hover:text-indigo-300"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentes.map((lic) => (
            <Link
              key={lic.slug}
              href={`/editais/${lic.slug}`}
              className="group rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5 transition-all hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5"
            >
              <div className="mb-3 flex items-center gap-2">
                {lic.uf && (
                  <Badge variant="outline" className="border-slate-700 text-xs text-slate-400">
                    {lic.uf}
                  </Badge>
                )}
                {lic.modalidade_contratacao && (
                  <Badge
                    variant="outline"
                    className="max-w-[160px] truncate border-slate-700 text-xs text-slate-500"
                  >
                    {lic.modalidade_contratacao}
                  </Badge>
                )}
              </div>
              <p className="line-clamp-2 text-sm leading-relaxed text-slate-300 transition-colors group-hover:text-white">
                {lic.objeto_compra}
              </p>
              <p className="mt-2 truncate text-xs text-slate-600">{lic.orgao_nome}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-400">
                  {lic.valor_total_estimado ? formatCurrency(lic.valor_total_estimado) : "-"}
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

      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-indigo-950/20 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <FileText className="mx-auto mb-4 h-10 w-10 text-indigo-400" />
          <h2 className="text-2xl font-bold text-white">
            Quer um radar configurado para o seu segmento?
          </h2>
          <p className="mt-3 text-slate-400">
            Falamos com voce no WhatsApp, entendemos sua operacao e configuramos
            uma implantacao assistida do LicitaIA para gerar triagem mais rapida.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={COMMERCIAL_MESSAGES.home}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3 text-sm font-medium text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Falar com o Diego agora
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/precos"
              className="inline-flex items-center rounded-xl border border-slate-700 px-8 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className={`text-2xl font-bold sm:text-3xl ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

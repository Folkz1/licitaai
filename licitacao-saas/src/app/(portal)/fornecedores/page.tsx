import { query } from "@/lib/db";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID } from "@/lib/portal";
import { COMMERCIAL_MESSAGES } from "@/lib/commercial";
import { SegmentIcon } from "@/lib/segment-icons";
import { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Search,
  MessageCircle,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache 1 hour

export const metadata: Metadata = {
  title: "Licitações por Segmento de Atuação | LicitaIA",
  description:
    "Encontre oportunidades de licitação do PNCP organizadas por área de atuação. 25 segmentos, 27 estados, dados públicos atualizados diariamente.",
  alternates: {
    canonical: `${APP_URL}/fornecedores`,
  },
  openGraph: {
    title: "Licitações por Segmento de Atuação | LicitaIA",
    description:
      "25 segmentos de licitação organizados para fornecedores. Encontre oportunidades no PNCP por área.",
    type: "website",
    siteName: "LicitaIA",
    url: `${APP_URL}/fornecedores`,
  },
};

interface Segmento {
  slug: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  keywords: string[];
}

export default async function FornecedoresPage() {
  const segmentos = await query<Segmento>(
    `SELECT slug, nome, descricao, icone, keywords
     FROM segmentos
     ORDER BY nome`
  );

  // Get total licitacoes count for the hero
  const statsRow = await query<{ total: string }>(
    `SELECT COUNT(*)::TEXT as total FROM licitacoes WHERE tenant_id = $1`,
    [PORTAL_PUBLIC_TENANT_ID]
  );
  const totalLicitacoes = parseInt(statsRow[0]?.total || "0", 10);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Badge className="mb-6 border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/10">
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            {segmentos.length} segmentos de atuação
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Licitações por Segmento
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              de Atuação
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Encontre oportunidades do PNCP organizadas por área.{" "}
            {totalLicitacoes > 0 && (
              <>
                <span className="text-white font-semibold">
                  {totalLicitacoes.toLocaleString("pt-BR")}
                </span>{" "}
                licitações monitoradas.{" "}
              </>
            )}
            Dados públicos atualizados diariamente.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/editais"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              <Search className="h-4 w-4" />
              Buscar por texto
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              <Zap className="h-4 w-4" />
              Configurar alertas
            </Link>
          </div>
        </div>
      </section>

      {/* Segments grid */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segmentos.map((seg) => (
            <Link
              key={seg.slug}
              href={`/fornecedores/${seg.slug}`}
              className="group rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5 transition-all hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 transition-colors group-hover:bg-indigo-500/20">
                  <SegmentIcon name={seg.icone} className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-white transition-colors group-hover:text-indigo-300">
                  {seg.nome}
                </h2>
              </div>
              {seg.descricao && (
                <p className="mb-3 text-sm text-slate-500 leading-relaxed">
                  {seg.descricao}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {seg.keywords.slice(0, 4).map((kw) => (
                  <Badge
                    key={kw}
                    variant="outline"
                    className="border-slate-700/60 text-xs text-slate-500"
                  >
                    {kw}
                  </Badge>
                ))}
                {seg.keywords.length > 4 && (
                  <span className="text-xs text-slate-600">
                    +{seg.keywords.length - 4}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm text-indigo-400 transition-colors group-hover:text-indigo-300">
                Ver licitações
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-indigo-950/20 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold text-white">
            Configure alertas automáticos para o seu segmento
          </h2>
          <p className="mt-3 text-slate-400">
            A IA do LicitaIA monitora o PNCP 24h e envia só as oportunidades
            relevantes. 7 dias grátis, sem cartão.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-base font-semibold text-slate-950 transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              Começar teste grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href={COMMERCIAL_MESSAGES.home}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-4 text-base font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              <MessageCircle className="h-5 w-5" />
              Falar com o Diego
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

import { query, queryOne } from "@/lib/db";
import { formatCurrency } from "@/lib/formatters";
import { APP_URL, PORTAL_PUBLIC_TENANT_ID } from "@/lib/portal";
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
  Zap,
  Target,
  BarChart3,
  Bell,
  Shield,
  Clock,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LicitaIA - Encontre Licitações do PNCP com Inteligência Artificial",
  description:
    "Monitore 50.000+ licitações públicas do PNCP em 27 estados. IA analisa editais automaticamente, filtra oportunidades relevantes e envia alertas. Teste grátis 7 dias.",
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    title: "LicitaIA - Encontre Licitações com IA",
    description:
      "50.000+ licitações monitoradas. IA analisa editais, filtra por relevância e envia alertas. Teste grátis.",
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
     LIMIT 6`,
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

  function formatCompactValue(v: number) {
    if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return formatCurrency(v);
  }

  return (
    <div>
      {/* HERO - Conversão */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Badge className="mb-6 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Teste grátis por 7 dias, sem cartão
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Pare de perder licitações
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              que você poderia ganhar
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            A IA do LicitaIA monitora o PNCP 24h, analisa editais automaticamente
            e entrega só as oportunidades que fazem sentido para o seu segmento.
            Chega de triagem manual.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-base font-semibold text-slate-950 transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              Começar teste grátis
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/editais"
              className="inline-flex items-center rounded-xl border border-slate-700 px-6 py-4 text-base font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              <Search className="mr-2 h-4 w-4" />
              Explorar editais
            </Link>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            Configuração em 5 minutos. Cancele quando quiser.
          </p>

          {/* Social proof numbers */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Licitações monitoradas" value={totalNum.toLocaleString("pt-BR")} />
            <Stat label="Estados cobertos" value={ufsNum.toString()} />
            <Stat label="Em oportunidades" value={formatCompactValue(valorTotal)} accent="text-emerald-400" />
            {analisadasNum > 0 && (
              <Stat
                label="Analisadas por IA"
                value={analisadasNum.toLocaleString("pt-BR")}
                accent="text-indigo-400"
              />
            )}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA - 3 passos */}
      <section className="border-t border-slate-800/40 bg-slate-950 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Como funciona
            </h2>
            <p className="mt-3 text-slate-400">
              Da configuração ao primeiro edital filtrado em menos de 10 minutos
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <StepCard
              number="1"
              icon={<Target className="h-6 w-6" />}
              title="Configure seu perfil"
              description="Informe seu segmento, palavras-chave e estados de interesse. A IA gera a configuração ideal automaticamente."
            />
            <StepCard
              number="2"
              icon={<Sparkles className="h-6 w-6" />}
              title="IA analisa os editais"
              description="O sistema monitora o PNCP diariamente, analisa cada edital e classifica por relevância para o seu negócio."
            />
            <StepCard
              number="3"
              icon={<Bell className="h-6 w-6" />}
              title="Receba só o que importa"
              description="Alertas automáticos por WhatsApp com as oportunidades que passaram na triagem. Sem ruído, sem perda de tempo."
            />
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Configurar meu radar agora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="border-t border-slate-800/40 bg-gradient-to-b from-slate-950 to-slate-900/50 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Por que empresas escolhem o LicitaIA
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <BenefitCard
              icon={<Clock className="h-5 w-5 text-indigo-400" />}
              title="Economia de 90% do tempo"
              description="A IA faz a triagem que sua equipe levaria horas. Só receba editais relevantes."
            />
            <BenefitCard
              icon={<BarChart3 className="h-5 w-5 text-emerald-400" />}
              title="Cobertura nacional"
              description={`${ufsNum} estados monitorados com ${totalNum.toLocaleString("pt-BR")} licitações atualizadas diariamente.`}
            />
            <BenefitCard
              icon={<Shield className="h-5 w-5 text-amber-400" />}
              title="Dados oficiais do PNCP"
              description="Fonte primária do governo federal. Sem intermediários, sem atraso."
            />
            <BenefitCard
              icon={<Sparkles className="h-5 w-5 text-purple-400" />}
              title="Análise com IA"
              description="Cada edital é lido, interpretado e classificado por relevância, valor e prazo."
            />
            <BenefitCard
              icon={<Bell className="h-5 w-5 text-rose-400" />}
              title="Alertas automáticos"
              description="Receba por WhatsApp quando uma licitação do seu segmento for publicada."
            />
            <BenefitCard
              icon={<Target className="h-5 w-5 text-cyan-400" />}
              title="Filtros inteligentes"
              description="Palavras-chave, faixa de valor, UF, modalidade. Você define, a IA filtra."
            />
          </div>
        </div>
      </section>

      {/* BUSCA RÁPIDA */}
      <section className="border-t border-slate-800/40 bg-slate-950 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white">
              Busque licitações agora
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              O portal público tem acesso a todas as {totalNum.toLocaleString("pt-BR")} licitações indexadas
            </p>
          </div>
          <form action="/editais" method="GET">
            <div className="relative mx-auto max-w-2xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                name="q"
                placeholder="Ex: tecnologia da informação, material hospitalar, papel..."
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
        </div>
      </section>

      {/* EXPLORAR POR ESTADO */}
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
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

      {/* ÚLTIMAS PUBLICAÇÕES */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Últimas publicações</h2>
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

      {/* PLANOS - Preview rápido */}
      <section className="border-t border-slate-800/40 bg-gradient-to-b from-slate-900/50 to-slate-950 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Planos a partir de R$ 197/mês
          </h2>
          <p className="mt-3 text-slate-400">
            Starter, Pro e Enterprise. Todos incluem análise com IA e alertas automáticos.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <PlanPreview name="Starter" price="R$ 197" highlight={false} features={["100 licitações/mês", "2 usuários", "Alertas WhatsApp"]} />
            <PlanPreview name="Pro" price="R$ 397" highlight={true} features={["500 licitações/mês", "5 usuários", "Análise prioritária"]} />
            <PlanPreview name="Enterprise" price="R$ 997" highlight={false} features={["Ilimitado", "50 usuários", "Suporte dedicado"]} />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/precos"
              className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Ver comparação completa <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-indigo-950/20 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-400" />
          <h2 className="text-2xl font-bold text-white">
            Comece a encontrar licitações do seu segmento agora
          </h2>
          <p className="mt-3 text-slate-400">
            Configure em 5 minutos. 7 dias grátis. Sem cartão de crédito.
            A IA começa a trabalhar imediatamente.
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

function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-2xl border border-slate-800/60 bg-slate-900/50 p-6 text-center">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
        Passo {number}
      </div>
      <div className="mx-auto mt-2 mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5">
      <div className="mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function PlanPreview({
  name,
  price,
  highlight,
  features,
}: {
  name: string;
  price: string;
  highlight: boolean;
  features: string[];
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-indigo-500/50 bg-indigo-500/5"
          : "border-slate-800/60 bg-slate-900/40"
      }`}
    >
      {highlight && (
        <span className="mb-2 inline-block rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
          Popular
        </span>
      )}
      <p className="text-sm font-medium text-slate-400">{name}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        {price}
        <span className="text-sm font-normal text-slate-500">/mês</span>
      </p>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

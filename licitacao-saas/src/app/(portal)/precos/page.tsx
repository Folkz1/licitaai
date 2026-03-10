import { query } from "@/lib/db";
import { APP_URL } from "@/lib/portal";
import { Check, ArrowRight } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

interface PlanRow {
  name: string;
  display_name: string;
  price_monthly_cents: number;
  max_licitacoes_per_month: number;
  max_users: number;
  max_searches_per_day: number;
  features: Record<string, unknown> | null;
}

const FAQ_ITEMS = [
  {
    question: "O que é o LicitaIA?",
    answer:
      "É uma plataforma que monitora licitações públicas do PNCP, organiza oportunidades por perfil e aplica IA para priorizar o que merece atenção comercial.",
  },
  {
    question: "Como funciona a análise por IA?",
    answer:
      "A IA lê o edital, extrai sinais de relevância, riscos, documentos e prazos para reduzir triagem manual e acelerar a decisão da equipe.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. O cancelamento é simples e a assinatura segue ativa até o fim do ciclo já pago.",
  },
  {
    question: "Preciso de cartão para começar?",
    answer:
      "Não necessariamente. O time comercial pode habilitar a melhor forma de ativação para sua operação.",
  },
  {
    question: "Tem teste grátis?",
    answer:
      "Sim. O onboarding permite validar aderência antes de expandir o uso dentro do time.",
  },
  {
    question: "Quantos usuários posso adicionar?",
    answer:
      "Depende do plano contratado. Os limites de usuários ficam explícitos na tabela comparativa abaixo.",
  },
];

export const metadata: Metadata = {
  title: "Planos e Preços - LicitaIA",
  description:
    "Compare os planos do LicitaIA para monitorar, buscar e analisar licitações com inteligência artificial.",
  openGraph: {
    title: "Planos e Preços - LicitaIA",
    description:
      "Starter, Pro e Enterprise para equipes que precisam captar licitações com mais velocidade.",
    type: "website",
    url: `${APP_URL}/precos`,
  },
};

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatLimit(value: number, fallback: string): string {
  return value >= 999999 ? fallback : value.toLocaleString("pt-BR");
}

export default async function PrecosPage() {
  const plans = await query<PlanRow>(
    `SELECT
      name,
      display_name,
      price_monthly_cents,
      max_licitacoes_per_month,
      max_users,
      max_searches_per_day,
      features
    FROM plans
    ORDER BY price_monthly_cents ASC`
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "LicitaIA",
    description:
      "SaaS para monitoramento e análise de licitações públicas com inteligência artificial.",
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.display_name,
      priceCurrency: "BRL",
      price: (plan.price_monthly_cents / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      url: `${APP_URL}/precos`,
    })),
  };

  const comparisonRows = [
    {
      label: "Licitações por mês",
      values: plans.map((plan) =>
        formatLimit(plan.max_licitacoes_per_month, "Ilimitado")
      ),
    },
    {
      label: "Usuários",
      values: plans.map((plan) => plan.max_users.toLocaleString("pt-BR")),
    },
    {
      label: "Buscas por dia",
      values: plans.map((plan) =>
        formatLimit(plan.max_searches_per_day, "Ilimitado")
      ),
    },
    {
      label: "Análise por IA",
      values: plans.map(() => "Incluída"),
    },
    {
      label: "Pipeline e kanban",
      values: plans.map(() => "Incluído"),
    },
    {
      label: "Suporte prioritário",
      values: plans.map((plan) =>
        plan.name === "enterprise" ? "Incluído" : "Sob demanda"
      ),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-slate-950 text-white">
        <section className="relative overflow-hidden border-b border-slate-800/70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_45%),linear-gradient(180deg,_rgba(15,23,42,0)_0%,_rgba(15,23,42,0.92)_100%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">
                Planos LicitaIA
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Escolha o plano para captar licitações com ritmo diário.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Starter, Pro e Enterprise para equipes que precisam buscar, filtrar,
                analisar e transformar oportunidades do PNCP em pipeline comercial.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
                >
                  Começar grátis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/editais"
                  className="inline-flex items-center rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  Ver portal público
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const isFeatured = plan.name === "pro";

              return (
                <article
                  key={plan.name}
                  className={`rounded-3xl border p-8 shadow-xl ${
                    isFeatured
                      ? "border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-slate-900"
                      : "border-slate-800 bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                        {plan.display_name}
                      </p>
                      <h2 className="mt-3 text-3xl font-semibold">
                        {formatPrice(plan.price_monthly_cents)}
                        <span className="ml-2 text-base font-normal text-slate-400">
                          /mês
                        </span>
                      </h2>
                    </div>
                    {isFeatured && (
                      <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
                        Mais escolhido
                      </span>
                    )}
                  </div>

                  <div className="mt-8 space-y-4 text-sm text-slate-300">
                    <Feature text={`${formatLimit(plan.max_licitacoes_per_month, "Ilimitadas")} licitações por mês`} />
                    <Feature text={`${plan.max_users.toLocaleString("pt-BR")} usuários`} />
                    <Feature text={`${formatLimit(plan.max_searches_per_day, "Ilimitadas")} buscas por dia`} />
                    <Feature text="Análises com IA e priorização de oportunidades" />
                    <Feature text="Portal público e flywheel de inteligência" />
                  </div>

                  <Link
                    href="/onboarding"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isFeatured
                        ? "bg-indigo-500 text-white hover:bg-indigo-400"
                        : "border border-slate-700 text-slate-100 hover:border-slate-500"
                    }`}
                  >
                    Começar grátis
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">
                Compare os recursos por plano
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                A mesma base de IA, com limites e capacidade operacional ajustados ao seu time.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-3 pr-6 font-medium">Recurso</th>
                    {plans.map((plan) => (
                      <th key={plan.name} className="py-3 pr-6 font-medium">
                        {plan.display_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {comparisonRows.map((row) => (
                    <tr key={row.label}>
                      <td className="py-4 pr-6 text-slate-200">{row.label}</td>
                      {row.values.map((value, index) => (
                        <td key={`${row.label}-${index}`} className="py-4 pr-6 text-slate-400">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-8">
            <h2 className="text-2xl font-semibold text-white">Perguntas frequentes</h2>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {FAQ_ITEMS.map((item) => (
                <article
                  key={item.question}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                >
                  <h3 className="text-base font-semibold text-white">
                    {item.question}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {item.answer}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-emerald-500/10 p-1 text-emerald-400">
        <Check className="h-3.5 w-3.5" />
      </div>
      <span>{text}</span>
    </div>
  );
}

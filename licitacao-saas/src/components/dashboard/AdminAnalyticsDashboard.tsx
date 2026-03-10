"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Activity,
  Users,
  MousePointerClick,
  Search,
  TrendingUp,
  CreditCard,
} from "lucide-react";

interface AnalyticsResponse {
  generatedAt: string;
  kpis: {
    visitors: {
      today: number;
      yesterday: number;
      last7Days: number;
      last30Days: number;
    };
    leads: {
      today: number;
      last7Days: number;
      last30Days: number;
    };
    publicSearches: {
      today: number;
      last7Days: number;
    };
    activeUsers: {
      last7Days: number;
    };
    subscriptions: {
      active: number;
      trial: number;
      expired: number;
    };
    conversion: {
      totalLeads: number;
      totalSignups: number;
      totalSubscribers: number;
      leadToSignupRate: number;
      signupToSubscriberRate: number;
      leadToSubscriberRate: number;
    };
  };
  charts: {
    daily: Array<{
      day: string;
      visitantes: number;
      pageviews: number;
      leads: number;
      buscas: number;
      licitacoes: number;
    }>;
    topPages: Array<{ path: string; views: number }>;
    topSearchTerms: Array<{ query: string; count: number }>;
    leadsBySource: Array<{ source: string; leads: number }>;
    usersByPlan: Array<{ plan: string; users: number }>;
  };
  tables: {
    latestLeads: Array<{
      nome: string;
      email: string;
      empresa: string | null;
      interesse: string | null;
      source: string | null;
      created_at: string;
    }>;
    latestSignups: Array<{
      nome: string;
      email: string;
      tenant: string;
      plano: string | null;
      created_at: string;
    }>;
    powerUsers: Array<{
      nome: string;
      email: string;
      tenant: string;
      logins: number;
      buscas: number;
      analises: number;
    }>;
    mostSearchedStates: Array<{
      uf: string;
      nome: string;
      searches: number;
    }>;
  };
}

const PIE_COLORS = ["#818cf8", "#38bdf8", "#34d399", "#f59e0b", "#f87171"];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateLabel(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

function formatTooltipValue(value: number | string | undefined): string {
  return formatNumber(Number(value || 0));
}

export default function AdminAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        const response = await fetch("/api/admin/analytics", {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Falha ao carregar analytics.");
        }

        const payload = (await response.json()) as AnalyticsResponse;
        if (active) {
          setData(payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro inesperado.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-white">Analytics</h1>
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
        {error || "Não foi possível carregar os analytics."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Painel consolidado do portal público, leads e uso da plataforma.
          </p>
        </div>
        <Badge className="border border-slate-700 bg-slate-900 text-slate-300">
          Atualizado em {formatDateTime(data.generatedAt)}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Visitantes"
          value={formatNumber(data.kpis.visitors.today)}
          subtitle={`Ontem ${formatNumber(data.kpis.visitors.yesterday)} | 7d ${formatNumber(data.kpis.visitors.last7Days)}`}
          icon={<MousePointerClick className="h-5 w-5" />}
        />
        <KpiCard
          title="Leads"
          value={formatNumber(data.kpis.leads.today)}
          subtitle={`7d ${formatNumber(data.kpis.leads.last7Days)} | 30d ${formatNumber(data.kpis.leads.last30Days)}`}
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          title="Usuários ativos"
          value={formatNumber(data.kpis.activeUsers.last7Days)}
          subtitle="Logaram nos últimos 7 dias"
          icon={<Activity className="h-5 w-5" />}
        />
        <KpiCard
          title="Assinantes ativos"
          value={formatNumber(data.kpis.subscriptions.active)}
          subtitle={`Trial ${formatNumber(data.kpis.subscriptions.trial)} | Expirados ${formatNumber(data.kpis.subscriptions.expired)}`}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <KpiCard
          title="Buscas públicas"
          value={formatNumber(data.kpis.publicSearches.today)}
          subtitle={`7d ${formatNumber(data.kpis.publicSearches.last7Days)}`}
          icon={<Search className="h-5 w-5" />}
        />
        <KpiCard
          title="Conversão lead → assinatura"
          value={`${data.kpis.conversion.leadToSubscriberRate.toFixed(1)}%`}
          subtitle={`Lead → signup ${data.kpis.conversion.leadToSignupRate.toFixed(1)}%`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Visitas por dia (30 dias)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.charts.daily}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="day" tickFormatter={formatDateLabel} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={(value) => formatDateLabel(String(value))}
              />
              <Legend />
              <Line type="monotone" dataKey="visitantes" stroke="#818cf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pageviews" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads por dia (30 dias)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.charts.daily}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="day" tickFormatter={formatDateLabel} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={(value) => formatDateLabel(String(value))}
              />
              <Bar dataKey="leads" fill="#34d399" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Buscas públicas por dia">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.charts.daily}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="day" tickFormatter={formatDateLabel} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={(value) => formatDateLabel(String(value))}
              />
              <Line type="monotone" dataKey="buscas" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Licitações adicionadas por dia">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.charts.daily}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="day" tickFormatter={formatDateLabel} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={(value) => formatDateLabel(String(value))}
              />
              <Bar dataKey="licitacoes" fill="#818cf8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 páginas mais acessadas">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.charts.topPages} layout="vertical">
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="path" type="category" width={160} stroke="#94a3b8" />
              <Tooltip formatter={formatTooltipValue} />
              <Bar dataKey="views" fill="#38bdf8" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 termos buscados">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.charts.topSearchTerms} layout="vertical">
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="query" type="category" width={160} stroke="#94a3b8" />
              <Tooltip formatter={formatTooltipValue} />
              <Bar dataKey="count" fill="#34d399" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads por fonte">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data.charts.leadsBySource}
                dataKey="leads"
                nameKey="source"
                outerRadius={110}
                innerRadius={55}
                paddingAngle={2}
              >
                {data.charts.leadsBySource.map((entry, index) => (
                  <Cell
                    key={`${entry.source}-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Usuários por plano">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data.charts.usersByPlan}
                dataKey="users"
                nameKey="plan"
                outerRadius={110}
                innerRadius={55}
                paddingAngle={2}
              >
                {data.charts.usersByPlan.map((entry, index) => (
                  <Cell
                    key={`${entry.plan}-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={formatTooltipValue} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          title="Últimos 20 leads"
          columns={["Nome", "Email", "Empresa", "Interesse", "Data", "Fonte"]}
          rows={data.tables.latestLeads.map((lead) => [
            lead.nome,
            lead.email,
            lead.empresa || "—",
            lead.interesse || "—",
            formatDateTime(lead.created_at),
            lead.source || "Direto",
          ])}
        />

        <DataTable
          title="Últimos 20 signups"
          columns={["Nome", "Email", "Tenant", "Plano", "Data"]}
          rows={data.tables.latestSignups.map((signup) => [
            signup.nome,
            signup.email,
            signup.tenant,
            signup.plano || "Sem plano",
            formatDateTime(signup.created_at),
          ])}
        />

        <DataTable
          title="Usuários que mais usam"
          columns={["Nome", "Tenant", "Logins", "Buscas", "Análises"]}
          rows={data.tables.powerUsers.map((user) => [
            `${user.nome}\n${user.email}`,
            user.tenant,
            formatNumber(user.logins),
            formatNumber(user.buscas),
            formatNumber(user.analises),
          ])}
        />

        <DataTable
          title="Estados mais buscados"
          columns={["UF", "Estado", "Buscas"]}
          rows={data.tables.mostSearchedStates.map((state) => [
            state.uf,
            state.nome,
            formatNumber(state.searches),
          ])}
        />
      </div>
    </div>
  );
}

function KpiCard(props: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-white">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-slate-400">{props.title}</p>
          <p className="mt-2 text-2xl font-semibold">{props.value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{props.subtitle}</p>
        </div>
        <div className="rounded-xl bg-slate-800/80 p-3 text-indigo-300">
          {props.icon}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard(props: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-white">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-white">
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}

function DataTable(props: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 text-white">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-white">
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead>
              <tr>
                {props.columns.map((column) => (
                  <th
                    key={column}
                    className="px-0 py-3 pr-4 text-left font-medium text-slate-400"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {props.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={props.columns.length}
                    className="py-6 text-sm text-slate-500"
                  >
                    Sem dados para o período.
                  </td>
                </tr>
              ) : (
                props.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${rowIndex}-${cellIndex}`}
                        className="whitespace-pre-line py-3 pr-4 align-top text-slate-200"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

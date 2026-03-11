"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Users,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Phone,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

interface FunnelItem {
  status: string;
  total: string;
}

interface Metrics {
  leads_semana: string;
  leads_mes: string;
  convertidos: string;
  trials_ativos: string;
  trials_expirados: string;
  trials_vencendo: string;
  score_medio: string;
  msgs_enviadas: string;
}

interface Lead {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  interesse: string | null;
  score: number;
  status: string;
  trial_status: string | null;
  trial_expires_at: string | null;
  trial_days_left: number | null;
  tenant_id: string | null;
  qualification_channel: string | null;
  last_contacted_at: string | null;
  created_at: string;
  msgs_sent: string;
}

interface RecentMessage {
  lead_name: string;
  step: number;
  status: string;
  sent_at: string | null;
}

interface SalesData {
  funnel: FunnelItem[];
  metrics: Metrics;
  leads: Lead[];
  recentMessages: RecentMessage[];
}

const STATUS_LABELS: Record<string, string> = {
  novo: "Novos",
  nurturing: "Nurturing",
  qualificado: "Qualificados",
  trial_ativo: "Trials ativos",
  trial_expirado: "Trials expirados",
  convertido: "Convertidos",
  frio: "Frios",
  perdido: "Perdidos",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-500",
  nurturing: "bg-amber-500",
  qualificado: "bg-emerald-500",
  trial_ativo: "bg-emerald-500",
  trial_expirado: "bg-red-500",
  convertido: "bg-green-500",
  frio: "bg-slate-500",
  perdido: "bg-red-500",
};

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-blue-500/10 text-blue-400",
  nurturing: "bg-amber-500/10 text-amber-400",
  qualificado: "bg-emerald-500/10 text-emerald-400",
  trial_ativo: "bg-emerald-500/10 text-emerald-400",
  trial_expirado: "bg-red-500/10 text-red-400",
  convertido: "bg-green-500/10 text-green-400",
  frio: "bg-slate-500/10 text-slate-400",
  perdido: "bg-red-500/10 text-red-400",
};

export default function SalesDashboard() {
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/vendas")
      .then((response) => response.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-24 rounded-xl bg-slate-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-slate-400">Erro ao carregar dados.</div>;
  }

  const funnelTotal = data.funnel.reduce((accumulator, item) => accumulator + Number(item.total), 0);
  const funnelOrder = [
    "novo",
    "nurturing",
    "qualificado",
    "trial_ativo",
    "trial_expirado",
    "convertido",
    "frio",
    "perdido",
  ];
  const sortedFunnel = [
    ...funnelOrder
      .map((status) => data.funnel.find((item) => item.status === status))
      .filter(Boolean) as FunnelItem[],
    ...data.funnel.filter((item) => !funnelOrder.includes(item.status)),
  ];
  const potentialRevenue = Number(data.metrics.trials_ativos) * 1497;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Motor de Vendas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Funil de leads, trials via WhatsApp e conversoes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Leads esta semana"
          value={data.metrics.leads_semana}
          color="text-blue-400"
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Leads este mes"
          value={data.metrics.leads_mes}
          color="text-indigo-400"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Trials ativos"
          value={data.metrics.trials_ativos}
          color="text-emerald-400"
          subtitle={`${data.metrics.trials_expirados} expirados`}
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Vencendo em 48h"
          value={data.metrics.trials_vencendo}
          color="text-amber-400"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Convertidos"
          value={data.metrics.convertidos}
          color="text-green-400"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Receita potencial"
          value={`R$${potentialRevenue.toLocaleString("pt-BR")}`}
          color="text-green-400"
          subtitle="trials ativos x R$1.497"
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Funil de Vendas</h2>
        <div className="space-y-3">
          {sortedFunnel.map((item) => {
            const percentage = funnelTotal > 0 ? (Number(item.total) / funnelTotal) * 100 : 0;

            return (
              <div key={item.status} className="flex items-center gap-4">
                <div className="w-28 text-sm text-slate-300">
                  {STATUS_LABELS[item.status] || item.status}
                </div>
                <div className="flex-1">
                  <div className="h-8 overflow-hidden rounded-lg bg-slate-800">
                    <div
                      className={`flex h-full items-center justify-end rounded-lg px-3 text-sm font-semibold text-white transition-all ${STATUS_COLORS[item.status] || "bg-slate-600"}`}
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    >
                      {item.total}
                    </div>
                  </div>
                </div>
                <div className="w-12 text-right text-sm text-slate-500">
                  {percentage.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          {Number(data.metrics.trials_vencendo) > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              {data.metrics.trials_vencendo} trial(s) vencem nas proximas 48 horas. Esses leads precisam de follow-up manual agora.
            </div>
          )}

          <h2 className="mb-4 text-lg font-semibold text-white">
            Leads ({data.leads.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-3 pr-4">Nome</th>
                  <th className="pb-3 pr-4">Interesse</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Trial</th>
                  <th className="pb-3 pr-4">Msgs</th>
                  <th className="pb-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((lead) => {
                  const trialExpiresAt = lead.trial_expires_at
                    ? new Date(lead.trial_expires_at)
                    : null;
                  const trialLabel =
                    lead.status === "trial_expirado"
                      ? "Expirado"
                      : lead.status === "trial_ativo"
                        ? `${lead.trial_days_left ?? 0}d`
                        : lead.trial_status || "—";

                  return (
                    <tr
                      key={lead.id}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${
                        lead.status === "trial_ativo" && (lead.trial_days_left ?? 99) <= 2
                          ? "bg-amber-500/5"
                          : ""
                      }`}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-white">{lead.nome}</div>
                        {lead.empresa && (
                          <div className="text-xs text-slate-500">{lead.empresa}</div>
                        )}
                        {lead.qualification_channel && (
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-600">
                            {lead.qualification_channel}
                          </div>
                        )}
                      </td>
                      <td className="max-w-[200px] py-3 pr-4 text-slate-400 truncate">
                        {lead.interesse || "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`font-semibold ${
                            lead.score > 50
                              ? "text-emerald-400"
                              : lead.score > 20
                                ? "text-amber-400"
                                : "text-slate-400"
                          }`}
                        >
                          {lead.score}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[lead.status] || "bg-slate-500/10 text-slate-400"}`}
                        >
                          {STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {lead.trial_expires_at ? (
                          <div>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                lead.status === "trial_expirado"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-emerald-500/10 text-emerald-400"
                              }`}
                            >
                              {trialLabel}
                            </span>
                            <div className="mt-1 text-xs text-slate-500">
                              {trialExpiresAt?.toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">{lead.msgs_sent}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          {lead.telefone && (
                            <a
                              href={`tel:${lead.telefone}`}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"
                              title="Ligar"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          {lead.telefone && (
                            <a
                              href={`https://wa.me/${lead.telefone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-emerald-400"
                              title="WhatsApp"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Mensagens Recentes</h2>
            <span className="text-xs text-slate-500">
              {data.metrics.msgs_enviadas} enviadas
            </span>
          </div>

          <div className="space-y-3">
            {data.recentMessages.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma mensagem ainda.</p>
            ) : (
              data.recentMessages.map((message, index) => (
                <div
                  key={`${message.lead_name}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-950/50 p-3"
                >
                  <div
                    className={`rounded-full p-1.5 ${
                      message.status === "sent"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : message.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : message.status === "pending"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-slate-500/10 text-slate-400"
                    }`}
                  >
                    {message.status === "sent" ? (
                      <ArrowRight className="h-3.5 w-3.5" />
                    ) : message.status === "failed" ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{message.lead_name}</p>
                    <p className="text-xs text-slate-500">
                      Step {message.step} · {message.status}
                      {message.sent_at &&
                        ` · ${new Date(message.sent_at).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
      {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
    </div>
  );
}

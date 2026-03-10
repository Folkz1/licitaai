"use client";

import { useEffect, useState } from "react";
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
  convertido: "Convertidos",
  frio: "Frios",
  perdido: "Perdidos",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-500",
  nurturing: "bg-amber-500",
  qualificado: "bg-emerald-500",
  convertido: "bg-green-500",
  frio: "bg-slate-500",
  perdido: "bg-red-500",
};

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-blue-500/10 text-blue-400",
  nurturing: "bg-amber-500/10 text-amber-400",
  qualificado: "bg-emerald-500/10 text-emerald-400",
  convertido: "bg-green-500/10 text-green-400",
  frio: "bg-slate-500/10 text-slate-400",
  perdido: "bg-red-500/10 text-red-400",
};

export default function SalesDashboard() {
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/vendas")
      .then((r) => r.json())
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
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-slate-400">Erro ao carregar dados.</div>;
  }

  const funnelTotal = data.funnel.reduce((a, b) => a + Number(b.total), 0);
  const funnelOrder = ["novo", "nurturing", "qualificado", "convertido", "frio", "perdido"];
  const sortedFunnel = funnelOrder
    .map((status) => data.funnel.find((f) => f.status === status))
    .filter(Boolean) as FunnelItem[];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Motor de Vendas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Funil de leads, nurturing WhatsApp e conversões
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Leads esta semana"
          value={data.metrics.leads_semana}
          color="text-blue-400"
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Leads este mês"
          value={data.metrics.leads_mes}
          color="text-indigo-400"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Convertidos"
          value={data.metrics.convertidos}
          color="text-emerald-400"
        />
        <KpiCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Mensagens enviadas"
          value={data.metrics.msgs_enviadas}
          color="text-amber-400"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Receita potencial"
          value={`R$${(Number(data.metrics.leads_semana) * 197).toLocaleString("pt-BR")}`}
          color="text-green-400"
          subtitle="leads × R$197"
        />
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Funil de Vendas</h2>
        <div className="space-y-3">
          {sortedFunnel.map((item) => {
            const pct = funnelTotal > 0 ? (Number(item.total) / funnelTotal) * 100 : 0;
            return (
              <div key={item.status} className="flex items-center gap-4">
                <div className="w-28 text-sm text-slate-300">
                  {STATUS_LABELS[item.status] || item.status}
                </div>
                <div className="flex-1">
                  <div className="h-8 overflow-hidden rounded-lg bg-slate-800">
                    <div
                      className={`h-full ${STATUS_COLORS[item.status] || "bg-slate-600"} flex items-center justify-end rounded-lg px-3 text-sm font-semibold text-white transition-all`}
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    >
                      {item.total}
                    </div>
                  </div>
                </div>
                <div className="w-12 text-right text-sm text-slate-500">
                  {pct.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Leads Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
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
                  <th className="pb-3 pr-4">Msgs</th>
                  <th className="pb-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{lead.nome}</div>
                      {lead.empresa && (
                        <div className="text-xs text-slate-500">{lead.empresa}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-400 max-w-[200px] truncate">
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Messages */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Mensagens Recentes</h2>
          <div className="space-y-3">
            {data.recentMessages.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma mensagem ainda.</p>
            ) : (
              data.recentMessages.map((msg, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-950/50 p-3"
                >
                  <div
                    className={`rounded-full p-1.5 ${
                      msg.status === "sent"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : msg.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : msg.status === "pending"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-slate-500/10 text-slate-400"
                    }`}
                  >
                    {msg.status === "sent" ? (
                      <ArrowRight className="h-3.5 w-3.5" />
                    ) : msg.status === "failed" ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{msg.lead_name}</p>
                    <p className="text-xs text-slate-500">
                      Step {msg.step} · {msg.status}
                      {msg.sent_at &&
                        ` · ${new Date(msg.sent_at).toLocaleDateString("pt-BR")}`}
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
  icon: React.ReactNode;
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

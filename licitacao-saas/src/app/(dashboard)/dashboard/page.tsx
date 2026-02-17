"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { WorkflowMonitor } from "@/components/dashboard/WorkflowMonitor";
import {
  FileText,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  Flame,
  Activity,
  BarChart3,
  Target,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

interface Stats {
  kpis: {
    total: string;
    analisadas: string;
    novas: string;
    no_pipeline: string;
    concluidas: string;
    valor_pipeline: string;
    valor_total: string;
  };
  byUf: { uf: string; count: string }[];
  byPriority: { prioridade: string; count: string }[];
  byWeek: { semana: string; count: string }[];
  byPhase: { phase: string; count: string }[];
  urgent?: { id: string; orgao_nome: string; objeto_compra: string; valor_total_estimado: number; data_encerramento_proposta: string; prioridade: string; uf: string }[];
  recentAnalyses?: { id: string; licitacao_id: string; prioridade: string; score_relevancia: number; justificativa: string; objeto_compra: string; orgao_nome: string }[];
  todayActivity?: {
    novas_hoje: string;
    analisadas_hoje: string;
    p1_hoje: string;
    p2_hoje: string;
    p3_hoje: string;
    rejeitadas_ia_hoje: string;
    novas_ontem: string;
    analisadas_ontem: string;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  P1: "#ef4444",
  P2: "#f59e0b",
  P3: "#6366f1",
  REJEITAR: "#4b5563",
};

const PRIORITY_LABELS: Record<string, string> = {
  P1: "Alta",
  P2: "Media",
  P3: "Baixa",
  REJEITAR: "Rejeitada",
};

const PHASE_COLORS: Record<string, { color: string; bg: string }> = {
  NOVA: { color: "text-slate-400", bg: "bg-slate-600/20" },
  PRE_TRIAGEM: { color: "text-sky-400", bg: "bg-sky-600/20" },
  ANALISE: { color: "text-indigo-400", bg: "bg-indigo-600/20" },
  DECISAO: { color: "text-purple-400", bg: "bg-purple-600/20" },
  PREPARACAO: { color: "text-amber-400", bg: "bg-amber-600/20" },
  PARTICIPANDO: { color: "text-emerald-400", bg: "bg-emerald-600/20" },
  CONCLUIDA: { color: "text-green-400", bg: "bg-green-600/20" },
  REJEITADA: { color: "text-red-400", bg: "bg-red-600/20" },
};

function formatCurrency(value: number) {
  if (isNaN(value) || value === 0) return "R$ 0";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyFull(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function daysUntil(date: string) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      /* toast error */
    }
    setLoading(false);
  }

  if (loading || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-sm text-slate-500">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const kpis = stats.kpis;
  const totalNum = parseInt(kpis.total) || 0;
  const analisadasNum = parseInt(kpis.analisadas) || 0;
  const novasNum = parseInt(kpis.novas) || 0;
  const pipelineNum = parseInt(kpis.no_pipeline) || 0;
  const concluidasNum = parseInt(kpis.concluidas) || 0;
  const valorPipeline = parseFloat(kpis.valor_pipeline) || 0;
  const valorTotal = parseFloat(kpis.valor_total) || 0;
  const taxaAnalise = totalNum > 0 ? Math.round((analisadasNum / totalNum) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <CalendarDays className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* Workflow Monitor - Trigger buttons + live progress */}
      <WorkflowMonitor
        onBuscaComplete={fetchStats}
        onAnaliseComplete={fetchStats}
      />

      {/* Today's Activity Summary */}
      {stats.todayActivity && (
        <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/30 via-slate-900/50 to-purple-950/30 p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
                <FileText className="h-4 w-4 text-sky-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-none">
                  +{stats.todayActivity.novas_hoje}
                </p>
                <p className="text-[10px] text-slate-500">novas hoje</p>
              </div>
              {parseInt(stats.todayActivity.novas_ontem) > 0 && (
                <span className="text-[10px] text-slate-600 ml-1">
                  ({stats.todayActivity.novas_ontem} ontem)
                </span>
              )}
            </div>

            <div className="w-px h-8 bg-slate-800" />

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-none">
                  {stats.todayActivity.analisadas_hoje}
                </p>
                <p className="text-[10px] text-slate-500">analisadas hoje</p>
              </div>
              {parseInt(stats.todayActivity.analisadas_ontem) > 0 && (
                <span className="text-[10px] text-slate-600 ml-1">
                  ({stats.todayActivity.analisadas_ontem} ontem)
                </span>
              )}
            </div>

            {parseInt(stats.todayActivity.analisadas_hoje) > 0 && (
              <>
                <div className="w-px h-8 bg-slate-800" />
                <div className="flex items-center gap-3">
                  {parseInt(stats.todayActivity.p1_hoje) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-400">
                      <Flame className="h-3 w-3" />
                      {stats.todayActivity.p1_hoje} P1
                    </span>
                  )}
                  {parseInt(stats.todayActivity.p2_hoje) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-400">
                      <Target className="h-3 w-3" />
                      {stats.todayActivity.p2_hoje} P2
                    </span>
                  )}
                  {parseInt(stats.todayActivity.p3_hoje) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
                      {stats.todayActivity.p3_hoje} P3
                    </span>
                  )}
                  {parseInt(stats.todayActivity.rejeitadas_ia_hoje) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-500">
                      {stats.todayActivity.rejeitadas_ia_hoje} rejeitadas
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards - Row 1: Big numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Captadas"
          value={totalNum.toString()}
          subtitle={`${novasNum} novas aguardando`}
          icon={<FileText className="h-5 w-5" />}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
          trend={novasNum > 0 ? `+${novasNum}` : undefined}
          trendColor="text-sky-400"
        />
        <KpiCard
          title="Analisadas por IA"
          value={analisadasNum.toString()}
          subtitle={`${taxaAnalise}% taxa de analise`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          progress={taxaAnalise}
        />
        <KpiCard
          title="No Pipeline"
          value={pipelineNum.toString()}
          subtitle={`${concluidasNum} concluidas`}
          icon={<Activity className="h-5 w-5" />}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10"
        />
        <KpiCard
          title="Valor em Pipeline"
          value={formatCurrency(valorPipeline)}
          subtitle={`Total: ${formatCurrency(valorTotal)}`}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          highlight
        />
      </div>

      {/* Row 2: Phase Pipeline + Urgent */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Phase Pipeline - Takes 3 cols */}
        <div className="lg:col-span-3 rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-300">Pipeline de Revisao</h3>
            </div>
            <Link href="/pipeline" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Ver Kanban <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Object.entries(PHASE_COLORS).map(([phase, config]) => {
              const count = stats.byPhase?.find((p) => p.phase === phase)?.count || "0";
              return (
                <div key={phase} className={`flex flex-col items-center p-2.5 rounded-lg ${config.bg} transition-all hover:scale-105`}>
                  <span className={`text-lg font-bold ${config.color}`}>{count}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 text-center leading-tight">
                    {phase.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Urgent tenders - Takes 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-red-900/30 bg-gradient-to-br from-red-950/20 to-slate-950/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-300">Encerrando em Breve</h3>
          </div>
          {stats.urgent && stats.urgent.length > 0 ? (
            <div className="space-y-2">
              {stats.urgent.slice(0, 4).map((u) => {
                const days = daysUntil(u.data_encerramento_proposta);
                return (
                  <Link key={u.id} href={`/licitacoes/${u.id}`} className="block group">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-900/10 transition-colors">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold
                        ${days !== null && days <= 2 ? "bg-red-900/40 text-red-400 animate-pulse" : "bg-orange-900/30 text-orange-400"}`}>
                        {days !== null ? `${days}d` : "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-300 truncate group-hover:text-white">{u.objeto_compra}</p>
                        <p className="text-[10px] text-slate-600 truncate">{u.orgao_nome} • {u.uf}</p>
                      </div>
                      <span className="text-xs font-semibold text-white shrink-0">{formatCurrency(u.valor_total_estimado)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center py-4">Nenhuma licitacao urgente</p>
          )}
        </div>
      </div>

      {/* Row 3: Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* UF Bar Chart */}
        <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-300">Distribuicao por Estado</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.byUf.map((d) => ({ ...d, count: parseInt(d.count) }))}>
              <XAxis dataKey="uf" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
                labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
                itemStyle={{ color: "#818cf8" }}
                cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
              />
              <Bar
                dataKey="count"
                fill="url(#barGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Pie */}
        <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-300">Prioridade das Licitacoes</h3>
          </div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie
                  data={stats.byPriority.map((d) => ({ name: d.prioridade, value: parseInt(d.count) }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {stats.byPriority.map((d, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[d.prioridade] || "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px" }}
                  itemStyle={{ color: "#e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {stats.byPriority.map((d) => (
                <div key={d.prioridade} className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[d.prioridade] || "#6b7280" }}
                  />
                  <span className="text-xs text-slate-400 flex-1">
                    {PRIORITY_LABELS[d.prioridade] || d.prioridade}
                  </span>
                  <span className="text-xs font-semibold text-white">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Timeline */}
      <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-300">Licitacoes nas Ultimas 8 Semanas</h3>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={stats.byWeek.map((d) => ({ ...d, count: parseInt(d.count) }))}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="semana"
              stroke="#334155"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            />
            <YAxis stroke="#334155" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
              labelFormatter={(v) => new Date(v).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
              labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
              itemStyle={{ color: "#a78bfa" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              fill="url(#areaGradient)"
              dot={{ fill: "#8b5cf6", strokeWidth: 0, r: 4 }}
              activeDot={{ fill: "#a78bfa", strokeWidth: 0, r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── KPI Card Component ─── */
function KpiCard({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  iconBg,
  highlight,
  trend,
  trendColor,
  progress,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  highlight?: boolean;
  trend?: string;
  trendColor?: string;
  progress?: number;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition-all hover:shadow-lg
        ${highlight
          ? "border-emerald-600/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-950/50 hover:shadow-emerald-500/5"
          : "border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 hover:shadow-indigo-500/5"
        }`}
    >
      {/* Decorative glow */}
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl opacity-20 ${iconBg}`} />

      <div className="flex items-start justify-between relative">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold ${trendColor || "text-sky-400"}`}>
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className={`text-2xl font-bold tracking-tight ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</p>
        <p className="text-xs text-slate-400 mt-1">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

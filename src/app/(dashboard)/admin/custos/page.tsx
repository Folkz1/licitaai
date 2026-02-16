"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  DollarSign,
  Cpu,
  Zap,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CostData {
  daily: { day: string; call_count: string; total_tokens: string; total_cost_usd: string }[];
  byWorkflow: { workflow: string; model: string; calls: string; tokens: string; cost: string }[];
  byTenant: { id: string; nome: string; total_calls: string; total_tokens: string; total_cost: string; plan_name: string; max_tokens_per_month: string }[];
  currentMonth: { tokens: string; cost: string; calls: string };
}

function formatUsd(v: number) {
  return `$${v.toFixed(4)}`;
}

function formatTokens(v: number) {
  if (v > 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v > 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

export default function CustosPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/llm-usage")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() => {
        setData({
          daily: [],
          byWorkflow: [],
          byTenant: [],
          currentMonth: { tokens: "0", cost: "0", calls: "0" },
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const cm = data.currentMonth;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Custos LLM</h1>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="pt-6">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <p className="mt-2 text-2xl font-bold text-white">{formatUsd(parseFloat(cm.cost))}</p>
            <p className="text-xs text-slate-400">Custo este mes</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="pt-6">
            <Cpu className="h-5 w-5 text-indigo-400" />
            <p className="mt-2 text-2xl font-bold text-white">{formatTokens(parseInt(cm.tokens))}</p>
            <p className="text-xs text-slate-400">Tokens consumidos</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="pt-6">
            <Zap className="h-5 w-5 text-amber-400" />
            <p className="mt-2 text-2xl font-bold text-white">{cm.calls}</p>
            <p className="text-xs text-slate-400">Chamadas IA</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Chart */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">Custo Diario (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.daily.map((d) => ({ ...d, cost: parseFloat(d.total_cost_usd) }))}>
              <XAxis
                dataKey="day"
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, "Custo"]}
              />
              <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Workflow */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-sm text-slate-300">Consumo por Workflow (mes atual)</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-400">Workflow</TableHead>
              <TableHead className="text-slate-400">Modelo</TableHead>
              <TableHead className="text-slate-400">Chamadas</TableHead>
              <TableHead className="text-slate-400">Tokens</TableHead>
              <TableHead className="text-slate-400">Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byWorkflow.map((w, i) => (
              <TableRow key={i} className="border-slate-800">
                <TableCell className="text-white">{w.workflow}</TableCell>
                <TableCell className="text-sm text-slate-300">{w.model}</TableCell>
                <TableCell className="text-slate-300">{w.calls}</TableCell>
                <TableCell className="text-slate-300">{formatTokens(parseInt(w.tokens))}</TableCell>
                <TableCell className="font-medium text-emerald-400">{formatUsd(parseFloat(w.cost))}</TableCell>
              </TableRow>
            ))}
            {data.byWorkflow.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500">Sem dados ainda</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* By Tenant (super admin) */}
      {data.byTenant.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <TrendingUp className="h-4 w-4" /> Consumo por Tenant (mes atual)
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Empresa</TableHead>
                <TableHead className="text-slate-400">Plano</TableHead>
                <TableHead className="text-slate-400">Chamadas</TableHead>
                <TableHead className="text-slate-400">Tokens</TableHead>
                <TableHead className="text-slate-400">Limite</TableHead>
                <TableHead className="text-slate-400">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byTenant.map((t) => {
                const tokens = parseInt(t.total_tokens);
                const limit = parseInt(t.max_tokens_per_month) || 1000000;
                const pct = Math.round((tokens / limit) * 100);
                return (
                  <TableRow key={t.id} className="border-slate-800">
                    <TableCell className="font-medium text-white">{t.nome}</TableCell>
                    <TableCell><Badge variant="outline">{t.plan_name || "N/A"}</Badge></TableCell>
                    <TableCell className="text-slate-300">{t.total_calls}</TableCell>
                    <TableCell className="text-slate-300">{formatTokens(tokens)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-slate-700">
                          <div
                            className={`h-2 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-emerald-400">
                      {formatUsd(parseFloat(t.total_cost))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

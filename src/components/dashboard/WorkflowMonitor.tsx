"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  Zap,
  AlertTriangle,
  Activity,
  Maximize2
} from "lucide-react";

interface LogEntry {
  time: string;
  message: string;
  level: string;
}

interface Execution {
  id: string;
  workflow_type: string;
  status: string;
  progress: number;
  current_step: string;
  metrics: Record<string, number>;
  logs: LogEntry[];
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

interface WorkflowMonitorProps {
  onBuscaComplete?: () => void;
  onAnaliseComplete?: () => void;
}

export function WorkflowMonitor({ onBuscaComplete, onAnaliseComplete }: WorkflowMonitorProps) {
  const [active, setActive] = useState<Execution[]>([]);
  const [recent, setRecent] = useState<Execution[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/n8n/status");
      const data = await res.json();
      
      // Check if something just completed
      const prevActiveIds = active.map(e => e.id);
      const nowActiveIds = (data.active || []).map((e: Execution) => e.id);
      const completed = prevActiveIds.filter(id => !nowActiveIds.includes(id));
      
      if (completed.length > 0 && data.recent) {
        for (const exec of data.recent) {
          if (completed.includes(exec.id)) {
            if (exec.workflow_type === "busca" && exec.status === "SUCCESS") onBuscaComplete?.();
            if (exec.workflow_type === "analise" && exec.status === "SUCCESS") onAnaliseComplete?.();
          }
        }
      }

      setActive(data.active || []);
      setRecent(data.recent || []);
    } catch { /* ignore */ }
  }, [active, onBuscaComplete, onAnaliseComplete]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function getStatusIcon(status: string) {
    switch (status) {
      case "RUNNING": return <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />;
      case "PENDING": return <Clock className="h-4 w-4 text-amber-400" />;
      case "SUCCESS": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case "ERROR": return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <Clock className="h-4 w-4 text-slate-500" />;
    }
  }

  function getStatusBadge(status: string) {
    const configs: Record<string, { label: string; className: string }> = {
      PENDING: { label: "Aguardando", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
      RUNNING: { label: "Executando", className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
      SUCCESS: { label: "Concluído", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
      ERROR: { label: "Erro", className: "bg-red-500/15 text-red-400 border-red-500/30" },
    };
    const conf = configs[status] || configs.PENDING;
    return <Badge className={`${conf.className} text-[10px]`}>{conf.label}</Badge>;
  }

  function formatDuration(start: string, end: string | null) {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diff = Math.floor((e - s) / 1000);
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  }

  function renderMetrics(metrics: Record<string, number>) {
    const entries = Object.entries(metrics).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {entries.map(([key, val]) => (
          <span key={key} className="rounded-md bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400">
            {key.replace(/_/g, " ")}: <strong className="text-white">{val}</strong>
          </span>
        ))}
      </div>
    );
  }

  function renderExecution(exec: Execution) {
    const isActive = exec.status === "RUNNING" || exec.status === "PENDING";
    const isExpanded = expandedLogs === exec.id;
    const logs = Array.isArray(exec.logs) ? exec.logs : [];

    return (
      <div
        key={exec.id}
        className={`rounded-xl border p-4 transition-all ${
          isActive
            ? "border-indigo-800/40 bg-gradient-to-br from-indigo-950/20 to-slate-900/50"
            : exec.status === "ERROR"
            ? "border-red-800/30 bg-red-950/10"
            : "border-slate-800/40 bg-slate-900/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(exec.status)}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {exec.workflow_type === "busca" ? "Busca PNCP" : "Análise IA"}
                </span>
                {getStatusBadge(exec.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {exec.current_step || "Aguardando..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600 font-mono">
              {formatDuration(exec.started_at, exec.finished_at)}
            </span>
            {logs.length > 0 && (
              <button
                onClick={() => setExpandedLogs(isExpanded ? null : exec.id)}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Terminal className="h-3 w-3" />
                {logs.length} logs
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isActive && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-500"
                style={{ width: `${Math.max(5, exec.progress)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1 text-right">{exec.progress}%</p>
          </div>
        )}

        {/* Error message */}
        {exec.error_message && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-950/30 border border-red-800/30 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300">{exec.error_message}</p>
          </div>
        )}

        {/* Metrics */}
        {renderMetrics(exec.metrics)}

        {/* Logs */}
        {isExpanded && logs.length > 0 && (
          <div className="mt-3 rounded-lg bg-slate-950/60 border border-slate-800/40 p-3 max-h-48 overflow-y-auto space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                <span className="text-slate-700 shrink-0">
                  {new Date(log.time).toLocaleTimeString("pt-BR")}
                </span>
                <span className={`shrink-0 w-3 text-center ${
                  log.level === "error" ? "text-red-500" : log.level === "warn" ? "text-amber-500" : "text-slate-600"
                }`}>
                  {log.level === "error" ? "✗" : log.level === "warn" ? "⚠" : "•"}
                </span>
                <span className={
                  log.level === "error" ? "text-red-300" : log.level === "warn" ? "text-amber-300" : "text-slate-400"
                }>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const activeCount = active.length;
  const runningExec = active[0]; // Most relevant running
  
  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      {/* Compact Status Bar (Trigger) */}
      <div className="w-full">
        {activeCount > 0 ? (
          <div 
            onClick={() => setSheetOpen(true)}
            className="group flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-950/30 px-4 py-2 cursor-pointer hover:bg-indigo-900/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  {activeCount} Processo(s) em andamento
                </p>
                {runningExec && (
                  <p className="text-xs text-indigo-300/80">
                    {runningExec.workflow_type === "busca" ? "Busca PNCP" : "Análise IA"}: {runningExec.current_step}
                  </p>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-indigo-300 hover:text-white hover:bg-indigo-900/50">
              <Maximize2 className="h-4 w-4 mr-1" />
              Ver Detalhes
            </Button>
          </div>
        ) : recent.length > 0 ? (
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSheetOpen(true)}
              className="text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
            >
              <Activity className="h-4 w-4 mr-2" />
              Atividade Recente
            </Button>
          </div>
        ) : null}
      </div>

      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-slate-950 border-l-slate-800 p-0">
        <SheetHeader className="p-6 border-b border-slate-800">
          <SheetTitle className="text-xl">Monitor de Processos</SheetTitle>
          <SheetDescription>
            Acompanhe o status das buscas e análises de licitações
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Active Executions */}
          {active.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                <Loader2 className="h-3 w-3 animate-spin" />
                Em Execução
              </div>
              <div className="space-y-3">
                {active.map(renderExecution)}
              </div>
            </div>
          )}

          {/* Recent Executions */}
          {recent.length > 0 && (
            <div className="space-y-3">
               <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Zap className="h-3 w-3" />
                Recentes
              </div>
              <div className="space-y-3">
                {recent.map(renderExecution)}
              </div>
            </div>
          )}

          {active.length === 0 && recent.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-900 p-3 mb-3">
                <Activity className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="text-sm font-medium text-slate-400">Nenhuma atividade recente</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-[200px]">
                Inicie uma busca ou análise para ver o progresso aqui.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

<<<<<<< HEAD
import { Clock, Calendar, AlertTriangle, Timer } from "lucide-react";
import { daysUntil, getDeadlineDate } from "@/lib/dateUtils";

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function DeadlineBadge({ date, showDate = false, licitacao }: { date?: string | null; showDate?: boolean; licitacao?: { data_encerramento_proposta?: string; data_abertura_propostas?: string; data_limite_envio_propostas?: string } | null }) {
  const effectiveDate = date || (licitacao ? getDeadlineDate(licitacao) : null);
  const days = daysUntil(effectiveDate);
  
  if (days === null || !effectiveDate) return null;

  if (days < 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1">
        <Clock className="h-3 w-3 text-red-500" />
        <span className="text-[10px] font-medium text-red-400">Encerrada</span>
        <span className="text-[9px] text-red-500/60">{formatDateFull(effectiveDate)}</span>
      </div>
    );
  }

  if (days === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-red-500/20 border border-red-500/40 px-2 py-1 animate-pulse">
        <AlertTriangle className="h-3 w-3 text-red-400" />
        <span className="text-[10px] font-bold text-red-400">HOJE!</span>
        <span className="text-[9px] text-red-300/70">{formatDateFull(effectiveDate)}</span>
      </div>
    );
  }

  if (days <= 2) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-red-500/15 border border-red-500/25 px-2 py-1">
        <Timer className="h-3 w-3 text-red-400" />
        <span className="text-[10px] font-bold text-red-400">{days}d</span>
        <span className="text-[9px] text-red-300/60">{formatDateFull(effectiveDate)}</span>
      </div>
    );
  }

  if (days <= 5) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-orange-500/15 border border-orange-500/25 px-2 py-1">
        <Clock className="h-3 w-3 text-orange-400" />
        <span className="text-[10px] font-semibold text-orange-400">{days}d</span>
        <span className="text-[9px] text-orange-300/60">{formatDateFull(effectiveDate)}</span>
      </div>
    );
  }

  if (days <= 10) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1">
        <Calendar className="h-3 w-3 text-amber-400" />
        <span className="text-[10px] font-medium text-amber-400">{days}d</span>
        <span className="text-[9px] text-amber-300/50">{formatDateFull(effectiveDate)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md bg-slate-700/30 border border-slate-600/20 px-2 py-1">
      <Calendar className="h-3 w-3 text-slate-400" />
      <span className="text-[10px] text-slate-400">{formatDateFull(effectiveDate)}</span>
      <span className="text-[9px] text-slate-500">({days}d)</span>
    </div>
=======
import { Clock, Calendar, AlertTriangle } from "lucide-react";
import { daysUntil } from "@/lib/dateUtils";

export function DeadlineBadge({ date }: { date: string }) {
  const days = daysUntil(date);
  if (days === null) return null;

  if (days < 0)
    return (
      <span className="flex items-center gap-1 rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">
        <Clock className="h-2.5 w-2.5" /> Encerrada
      </span>
    );
  if (days === 0)
    return (
      <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400 animate-pulse">
        <AlertTriangle className="h-2.5 w-2.5" /> Hoje!
      </span>
    );
  if (days <= 3)
    return (
      <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
        <Clock className="h-2.5 w-2.5" /> {days}d
      </span>
    );
  if (days <= 7)
    return (
      <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
        <Clock className="h-2.5 w-2.5" /> {days}d
      </span>
    );
  return (
    <span className="flex items-center gap-1 rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">
      <Calendar className="h-2.5 w-2.5" /> {days}d
    </span>
>>>>>>> master
  );
}

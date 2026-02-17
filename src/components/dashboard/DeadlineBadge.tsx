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
  );
}

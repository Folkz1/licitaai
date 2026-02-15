import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PipelineItem } from "@/types/pipeline";
import { PRIORITY_CONFIG } from "@/constants/pipeline";
import { formatCurrency } from "@/lib/formatters";
import { DeadlineBadge } from "@/components/dashboard/DeadlineBadge";
import Link from "next/link";
import {
  Building2,
  DollarSign,
  ArrowRight,
  XCircle,
} from "lucide-react";

interface SortablePipelineItemProps {
  item: PipelineItem;
  phaseKey: string;
  nextPhaseKey?: string;
  prevPhaseKey?: string;
  nextPhaseLabel?: string;
  prevPhaseLabel?: string;
  onMoveToPhase: (id: string, phase: string) => void;
  onReject: (id: string) => void;
  onOpenNote: (id: string, phase: string) => void;
  isMoving?: boolean;
}

export function SortablePipelineItem({
  item,
  phaseKey,
  nextPhaseKey,
  prevPhaseKey,
  nextPhaseLabel,
  prevPhaseLabel,
  onMoveToPhase,
  onReject,
  onOpenNote,
  isMoving
}: SortablePipelineItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { item, phaseKey } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const prio = PRIORITY_CONFIG[item.prioridade];

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={`border-slate-800 bg-slate-900/70 transition-all cursor-grab active:cursor-grabbing ${
          isMoving ? "opacity-50 scale-95" : "hover:bg-slate-800/70 hover:border-slate-700"
        }`}
      >
        <CardContent className="space-y-2 p-3">
          {/* Top row: priority + deadline */}
          <div className="flex items-center justify-between">
            {prio ? (
              <Badge className={`border text-[10px] ${prio.bg} ${prio.color}`}>
                {item.prioridade} - {prio.label}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
                Sem prioridade
              </Badge>
            )}
            <DeadlineBadge date={item.data_encerramento_proposta} />
          </div>

          {/* Object title */}
          <Link
            href={`/licitacoes/${item.id}`}
            className="block text-sm font-medium text-white hover:text-indigo-400 line-clamp-2 leading-tight"
            // Stop propagation to prevent drag start when clicking link
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={(e) => e.stopPropagation()}
          >
            {item.objeto_compra?.slice(0, 100)}
          </Link>

          {/* Org info */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.orgao_nome?.slice(0, 40)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(item.valor_total_estimado)}
              </span>
              <Badge variant="outline" className="h-4 text-[9px] border-slate-700">
                {item.uf}
                {item.municipio ? ` - ${item.municipio.slice(0, 15)}` : ""}
              </Badge>
            </div>
            {item.modalidade_contratacao && (
              <div className="text-[10px] text-slate-600">
                {item.modalidade_contratacao}
              </div>
            )}
          </div>

          {/* Score bar */}
          {item.score_relevancia && (
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-slate-800">
                <div
                  className={`h-1 rounded-full ${
                    item.score_relevancia >= 80
                      ? "bg-emerald-500"
                      : item.score_relevancia >= 60
                        ? "bg-amber-500"
                        : "bg-slate-600"
                  }`}
                  style={{ width: `${item.score_relevancia}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">
                {item.score_relevancia}%
              </span>
            </div>
          )}

          {/* Actions */}
          <div 
            className="flex items-center gap-1 border-t border-slate-800/50 pt-2"
            onPointerDown={(e) => e.stopPropagation()} // Prevent drag
          >
            {prevPhaseLabel && prevPhaseKey && phaseKey !== "NOVA" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-amber-400 hover:bg-amber-900/20"
                onClick={() => onMoveToPhase(item.id, prevPhaseKey)}
                title={`Voltar para ${prevPhaseLabel}`}
                disabled={isMoving}
              >
                ← Voltar
              </Button>
            )}
            <div className="flex-1" />
            {nextPhaseLabel && nextPhaseKey && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20"
                onClick={() => onOpenNote(item.id, nextPhaseKey)}
                disabled={isMoving}
              >
                {nextPhaseLabel} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-red-400/50 hover:text-red-400 hover:bg-red-900/20"
              onClick={() => onReject(item.id)}
              disabled={isMoving}
              title="Rejeitar"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

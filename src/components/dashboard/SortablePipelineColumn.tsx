import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PipelineItem } from "@/types/pipeline";
import { SortablePipelineItem } from "./SortablePipelineItem";
import { formatCurrency } from "@/lib/formatters";
import { PHASES } from "@/constants/pipeline";

interface SortablePipelineColumnProps {
  phase: typeof PHASES[0];
  items: PipelineItem[];
  collapsed: boolean;
  onToggleCollapse: (key: string) => void;
  loading?: boolean;
  onMoveToPhase: (id: string, phase: string) => void;
  onReject: (id: string) => void;
  onOpenNote: (id: string, phase: string) => void;
  movingId: string | null;
}

export function SortablePipelineColumn({
  phase,
  items,
  collapsed,
  onToggleCollapse,
  loading,
  onMoveToPhase,
  onReject,
  onOpenNote,
  movingId
}: SortablePipelineColumnProps) {
  const { setNodeRef } = useDroppable({
    id: phase.key,
  });

  const PhaseIcon = phase.icon;
  const phaseValue = items.reduce((s, i) => s + (Number(i.valor_total_estimado) || 0), 0);
  const itemIds = items.map((i) => i.id);

  const phaseIndex = PHASES.indexOf(phase);
  const nextPhase = PHASES[phaseIndex + 1];
  const prevPhase = PHASES[phaseIndex - 1];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-shrink-0 flex-col transition-all ${
        collapsed ? "min-w-[60px]" : "min-w-[310px] max-w-[310px]"
      }`}
    >
      {/* Column Header */}
      <div
        className={`mb-2 rounded-t-lg border-b-2 ${phase.color} ${phase.headerBg} p-2 cursor-pointer select-none`}
        onClick={() => onToggleCollapse(phase.key)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhaseIcon className="h-4 w-4 text-slate-300" />
            {!collapsed && (
              <span className="text-sm font-medium text-slate-200">{phase.label}</span>
            )}
            <Badge
              variant="outline"
              className="h-5 min-w-[24px] justify-center border-slate-600 text-[10px]"
            >
              {items.length}
            </Badge>
          </div>
          {!collapsed && (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          )}
          {collapsed && (
            <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
          )}
        </div>
        {!collapsed && (
          <>
            <p className="mt-1 text-[10px] text-slate-500">{phase.description}</p>
            {phaseValue > 0 && (
              <p className="mt-1 text-[10px] font-medium text-emerald-400/80">
                {formatCurrency(phaseValue)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Cards container */}
      {!collapsed && (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-[150px]" style={{ maxHeight: "calc(100vh - 280px)" }}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortablePipelineItem
                key={item.id}
                item={item}
                phaseKey={phase.key}
                nextPhaseKey={nextPhase?.key}
                prevPhaseKey={prevPhase?.key}
                nextPhaseLabel={nextPhase?.label}
                prevPhaseLabel={prevPhase?.label}
                onMoveToPhase={onMoveToPhase}
                onReject={onReject}
                onOpenNote={onOpenNote}
                isMoving={movingId === item.id}
              />
            ))}
          </SortableContext>

          {items.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-700/50 p-6 text-center">
              <PhaseIcon className="h-6 w-6 text-slate-700" />
              <p className="text-xs text-slate-600">Arraste itens para cá</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

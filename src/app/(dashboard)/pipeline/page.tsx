"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkflowMonitor } from "@/components/dashboard/WorkflowMonitor";
import {
  RefreshCw,
  Search,
  Filter,
  Ban,
  Brain,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import { PipelineItem } from "@/types/pipeline";
import { PHASES } from "@/constants/pipeline";
import { SortablePipelineColumn } from "@/components/dashboard/SortablePipelineColumn";
import { SortablePipelineItem } from "@/components/dashboard/SortablePipelineItem";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/formatters";

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.5",
      },
    },
  }),
};

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [showRejected, setShowRejected] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ id: string; toPhase: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  
  // Workflow Trigger States
  const [triggeringBusca, setTriggeringBusca] = useState(false);
  const [triggeringAnalise, setTriggeringAnalise] = useState(false);

  // DnD State
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchData = useCallback(async () => {
    // Silent update if we already have items to avoid flickering
    if (items.length === 0) setLoading(true);
    try {
      const res = await fetch("/api/licitacoes?limit=500");
      const data = await res.json();
      setItems(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.objeto_compra?.toLowerCase().includes(q) ||
          i.orgao_nome?.toLowerCase().includes(q) ||
          i.municipio?.toLowerCase().includes(q)
      );
    }
    if (filterPriority) {
      result = result.filter((i) => i.prioridade === filterPriority);
    }
    return result;
  }, [items, searchQuery, filterPriority]);

  const rejectedItems = useMemo(
<<<<<<< HEAD
    () => filteredItems.filter((i) => i.review_phase === "REJEITADA"),
=======
    () => filteredItems.filter((i) => i.review_phase === "REJEITADA" || i.tipo_oportunidade === "PRE_TRIAGEM_REJEITAR"),
>>>>>>> master
    [filteredItems]
  );

  const stats = useMemo(() => {
<<<<<<< HEAD
    const active = items.filter((i) => i.review_phase !== "REJEITADA" && i.review_phase !== "CONCLUIDA");
=======
    const active = items.filter((i) => i.review_phase !== "REJEITADA" && i.review_phase !== "CONCLUIDA" && i.tipo_oportunidade !== "PRE_TRIAGEM_REJEITAR");
>>>>>>> master
    const totalValue = active.reduce((s, i) => s + (Number(i.valor_total_estimado) || 0), 0);
    const urgent = active.filter((i) => {
      if (!i.data_encerramento_proposta) return false;
      const days = Math.ceil((new Date(i.data_encerramento_proposta).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 3;
    });
    return {
      total: items.length,
      active: active.length,
      totalValue,
      urgent: urgent.length,
      rejected: rejectedItems.length,
    };
  }, [items, rejectedItems]);

  async function moveToPhase(id: string, toPhase: string, note?: string) {
    setMovingId(id);
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, review_phase: toPhase } : item))
    );

    try {
      await fetch(`/api/licitacoes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADVANCE", toPhase, note }),
      });
    } catch {
      // Revert if failed (could implement toaster here)
      console.error("Failed to update phase");
      fetchData(); // Sync with server
    }

    setMovingId(null);
    setNoteModal(null);
    setNoteText("");
  }

  async function reject(id: string) {
    setMovingId(id);
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, review_phase: "REJEITADA" } : item))
    );

    try {
      await fetch(`/api/licitacoes/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", toPhase: "REJEITADA" }),
      });
    } catch {
      fetchData();
    }
    setMovingId(null);
  }

  function toggleCollapse(key: string) {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Workflow Handlers
  async function callWorkflow(endpoint: string, setTrigger: (v: boolean) => void) {
    setTrigger(true);
    try {
      await fetch(endpoint, { method: "POST" });
      // We don't need to do anything else, WorkflowMonitor will pick up the new execution
    } catch (e) {
      console.error("Workflow trigger failed", e);
    } finally {
      setTrigger(false);
    }
  }

  // DnD Handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    const activeItem = items.find(i => i.id === activeItemId);
    const overItem = items.find(i => i.id === overId);
    
    // Find target phase
    let targetPhase = "";
    
    // If dropped on a column (droppable id is phase key)
    const isOverColumn = PHASES.some(p => p.key === overId);
    if (isOverColumn) {
      targetPhase = overId;
    } 
    // If dropped on another item
    else if (overItem) {
      targetPhase = overItem.review_phase || "NOVA";
    }

    if (activeItem && targetPhase && activeItem.review_phase !== targetPhase) {
      moveToPhase(activeItemId, targetPhase);
    }
  }

  const activeItem = useMemo(() => items.find(i => i.id === activeId), [items, activeId]);

  if (loading && items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-400">Carregando pipeline...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header with Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold">Pipeline de Licitações</h1>
          <p className="text-sm text-slate-400">
            Gerencie o fluxo completo desde a descoberta até a participação
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button
            variant="outline"
            size="sm"
            onClick={() => callWorkflow("/api/n8n/trigger-busca", setTriggeringBusca)}
            disabled={triggeringBusca}
            className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-950/30 hover:text-indigo-300"
          >
            {triggeringBusca ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Buscar PNCP
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => callWorkflow("/api/n8n/trigger-analise", setTriggeringAnalise)}
            disabled={triggeringAnalise}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-950/30 hover:text-purple-300"
          >
            {triggeringAnalise ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            Analisar com IA
          </Button>
          <Button onClick={fetchData} variant="ghost" size="icon" className="text-slate-500">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Monitor + KPI Bar */}
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex-1">
          <WorkflowMonitor
            onBuscaComplete={fetchData}
            onAnaliseComplete={fetchData}
          />
        </div>
        
        {/* Compact stats */}
        <div className="flex items-center gap-4 bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Total Ativo</span>
            <p className="text-lg font-bold text-white leading-none">{stats.active}</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
             <span className="text-[10px] text-slate-500 uppercase">Valor Total</span>
             <p className="text-lg font-bold text-emerald-400 leading-none">{formatCurrency(stats.totalValue)}</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
           <div>
             <span className="text-[10px] text-slate-500 uppercase">Urgentes</span>
             <p className="text-lg font-bold text-red-400 leading-none">{stats.urgent}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Buscar objeto, órgão, município..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-sm h-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-slate-500" />
          {["", "P1", "P2", "P3"].map((p) => (
            <Button
              key={p}
              size="sm"
              variant={filterPriority === p ? "default" : "ghost"}
              className={`h-7 text-xs ${
                filterPriority === p
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setFilterPriority(p)}
            >
              {p || "Todas"}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className={`h-7 text-xs ${showRejected ? "text-red-400" : "text-slate-500"}`}
          onClick={() => setShowRejected(!showRejected)}
        >
          <Ban className="mr-1 h-3 w-3" />
          Rejeitadas ({stats.rejected})
        </Button>
      </div>

      {/* Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl animate-in zoom-in-95">
            <h3 className="mb-3 text-lg font-semibold">Adicionar Nota</h3>
            <p className="mb-3 text-sm text-slate-400">
              Nota opcional ao mover para a próxima fase
            </p>
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              rows={3}
              placeholder="Ex: Edital verificado, itens compatíveis com nosso catálogo..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                className="text-slate-400"
                onClick={() => {
                  setNoteModal(null);
                  setNoteText("");
                }}
              >
                Cancelar
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => moveToPhase(noteModal.id, noteModal.toPhase, noteText || undefined)}
              >
                Mover
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto pb-4 px-1" style={{ minHeight: "calc(100vh - 250px)" }}>
          {PHASES.map((phase) => {
            const phaseItems = filteredItems.filter(
<<<<<<< HEAD
              (i) => (i.review_phase || "NOVA") === phase.key
=======
              (i) => (i.review_phase || "NOVA") === phase.key && i.tipo_oportunidade !== "PRE_TRIAGEM_REJEITAR"
>>>>>>> master
            )
            .sort((a, b) => {
                // Keep sort logic for consistency
                const pOrder: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
                const pa = pOrder[a.prioridade] ?? 3;
                const pb = pOrder[b.prioridade] ?? 3;
                if (pa !== pb) return pa - pb;
                const da = a.data_encerramento_proposta ? new Date(a.data_encerramento_proposta).getTime() : Infinity;
                const db = b.data_encerramento_proposta ? new Date(b.data_encerramento_proposta).getTime() : Infinity;
                return da - db;
            });

            return (
              <SortablePipelineColumn
                key={phase.key}
                phase={phase}
                items={phaseItems}
                collapsed={collapsedPhases.has(phase.key)}
                onToggleCollapse={toggleCollapse}
                onMoveToPhase={moveToPhase}
                onReject={reject}
                onOpenNote={(id, toPhase) => setNoteModal({ id, toPhase })}
                movingId={movingId}
              />
            );
          })}
        </div>

        {createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {activeItem ? (
              <div className="opacity-90 rotate-3 cursor-grabbing w-[300px]">
                <SortablePipelineItem
                   item={activeItem}
                   phaseKey={activeItem.review_phase}
                   onMoveToPhase={() => {}}
                   onReject={() => {}}
                   onOpenNote={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      {/* Rejected section */}
      {showRejected && rejectedItems.length > 0 && (
        <div className="border-t border-slate-800 pt-4 px-1">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-400">
            <Ban className="h-4 w-4" />
            Rejeitadas ({rejectedItems.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
<<<<<<< HEAD
            {rejectedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-900/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm text-slate-400 hover:text-white"
                  >
                    {item.objeto_compra?.slice(0, 60)}
                  </span>
                  <p className="truncate text-xs text-slate-600">{item.orgao_nome?.slice(0, 40)}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 shrink-0 text-[10px] text-indigo-400"
                  onClick={() => moveToPhase(item.id, "NOVA")}
                >
                  Restaurar
                </Button>
              </div>
            ))}
=======
            {rejectedItems.map((item) => {
              const isAiRejected = item.tipo_oportunidade === "PRE_TRIAGEM_REJEITAR";
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-900/30 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isAiRejected && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium text-purple-300 bg-purple-900/40">
                          <Brain className="h-2.5 w-2.5" />
                          IA
                        </span>
                      )}
                      <span className="block truncate text-sm text-slate-400 hover:text-white">
                        {item.objeto_compra?.slice(0, 55)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-600">{item.orgao_nome?.slice(0, 40)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 text-[10px] text-indigo-400"
                    onClick={() => moveToPhase(item.id, "NOVA")}
                  >
                    Restaurar
                  </Button>
                </div>
              );
            })}
>>>>>>> master
          </div>
        </div>
      )}
    </div>
  );
}

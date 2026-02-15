"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowUpRight,
  Flame,
  Timer,
  Target,
  FileWarning,
  Sparkles,
} from "lucide-react";

interface Licitacao {
  id: string;
  numero_controle_pncp: string;
  orgao_nome: string;
  objeto_compra: string;
  valor_total_estimado: number;
  data_encerramento_proposta: string;
  data_publicacao: string;
  uf: string;
  municipio: string;
  status: string;
  review_phase: string;
  prioridade: string;
  link_sistema_origem: string;
  modalidade_contratacao: string;
  tipo_participacao: string;
  score_relevancia: number;
  justificativa: string;
  amostra_exigida: boolean;
  valor_itens_relevantes: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PRIORITY_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.ReactNode;
  }
> = {
  P1: {
    label: "Prioridade Alta",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: <Flame className="h-3.5 w-3.5" />,
  },
  P2: {
    label: "Prioridade Media",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: <Target className="h-3.5 w-3.5" />,
  },
  P3: {
    label: "Prioridade Baixa",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: <Timer className="h-3.5 w-3.5" />,
  },
  REJEITAR: {
    label: "Rejeitada",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  NOVA: {
    label: "Nova",
    color: "text-sky-400",
    icon: <Sparkles className="h-3 w-3" />,
  },
  ANALISADA: {
    label: "Analisada",
    color: "text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  SEM_EDITAL: {
    label: "Sem Edital",
    color: "text-orange-400",
    icon: <FileWarning className="h-3 w-3" />,
  },
  ERRO_OCR: {
    label: "Erro OCR",
    color: "text-red-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  NOVA: { label: "Nova", color: "bg-slate-600" },
  PRE_TRIAGEM: { label: "Pre-Triagem", color: "bg-sky-600" },
  ANALISE: { label: "Analise", color: "bg-indigo-600" },
  DECISAO: { label: "Decisao", color: "bg-purple-600" },
  PREPARACAO: { label: "Preparacao", color: "bg-amber-600" },
  PARTICIPANDO: { label: "Participando", color: "bg-emerald-600" },
  CONCLUIDA: { label: "Concluida", color: "bg-green-600" },
  REJEITADA: { label: "Rejeitada", color: "bg-red-900" },
};

function formatCurrency(value: number) {
  if (!value) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function daysUntil(date: string) {
  if (!date) return null;
  const diff = Math.ceil(
    (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

function getUrgencyConfig(days: number | null, date: string) {
  const dateStr = date ? new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "-";
  
  if (days === null)
    return { text: "Sem prazo", shortText: "-", color: "text-slate-500", bg: "bg-slate-800", date: dateStr };
  if (days < 0)
    return { text: "Encerrada", shortText: "-", color: "text-red-500", bg: "bg-red-950/50", date: dateStr };
  if (days === 0)
    return { text: "HOJE!", shortText: "HOJE", color: "text-red-400", bg: "bg-red-900/40 animate-pulse", date: dateStr };
  if (days <= 2)
    return { text: `${days} dia${days > 1 ? 's' : ''}`, shortText: `${days}d`, color: "text-red-400", bg: "bg-red-900/30", date: dateStr };
  if (days <= 5)
    return { text: `${days} dias`, shortText: `${days}d`, color: "text-orange-400", bg: "bg-orange-900/30", date: dateStr };
  if (days <= 10)
    return { text: `${days} dias`, shortText: `${days}d`, color: "text-amber-400", bg: "bg-amber-900/20", date: dateStr };
  return { text: `${days} dias`, shortText: `${days}d`, color: "text-emerald-400", bg: "bg-emerald-900/20", date: dateStr };
}

export default function LicitacoesPage() {
  const router = useRouter();
  const [data, setData] = useState<Licitacao[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    phase: "",
    uf: "",
    search: "",
    priority: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filters.status) params.set("status", filters.status);
      if (filters.phase) params.set("phase", filters.phase);
      if (filters.uf) params.set("uf", filters.uf);
      if (filters.search) params.set("search", filters.search);
      if (filters.priority) params.set("priority", filters.priority);

      try {
        const res = await fetch(`/api/licitacoes?${params}`);
        const json = await res.json();
        setData(json.data || []);
        setPagination(
          json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
        );
      } catch {
        setData([]);
      }
      setLoading(false);
    },
    [filters],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearchChange(value: string) {
    setFilters((f) => ({ ...f, search: value }));
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchData(), 500);
  }

  const activeFilterCount = [
    filters.status,
    filters.phase,
    filters.uf,
    filters.priority,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Licitacoes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {pagination.total} licitacoes encontradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className={`border-slate-700 gap-1.5 transition-colors ${showFilters ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300" : ""}`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            onClick={() => fetchData()}
            variant="outline"
            size="sm"
            className="border-slate-700 gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Buscar por objeto, orgao, municipio..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 border-slate-700/50 bg-slate-900/80 text-white h-11 text-sm placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-indigo-500/20"
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
          <Select
            value={filters.status || "ALL"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, status: v === "ALL" ? "" : v }))
            }
          >
            <SelectTrigger className="w-36 border-slate-700/50 bg-slate-800/50 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-800">
              <SelectItem value="ALL">Todos Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.phase || "ALL"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, phase: v === "ALL" ? "" : v }))
            }
          >
            <SelectTrigger className="w-36 border-slate-700/50 bg-slate-800/50 text-sm">
              <SelectValue placeholder="Fase" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-800">
              <SelectItem value="ALL">Todas Fases</SelectItem>
              {Object.entries(PHASE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.priority || "ALL"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, priority: v === "ALL" ? "" : v }))
            }
          >
            <SelectTrigger className="w-40 border-slate-700/50 bg-slate-800/50 text-sm">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-800">
              <SelectItem value="ALL">Todas Prioridades</SelectItem>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters({
                  status: "",
                  phase: "",
                  uf: "",
                  search: filters.search,
                  priority: "",
                })
              }
              className="text-slate-400 hover:text-white text-xs"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
            </div>
            <p className="text-sm text-slate-500">Carregando licitacoes...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <Search className="h-10 w-10 text-slate-700" />
          <p className="text-slate-500">Nenhuma licitacao encontrada</p>
          <p className="text-xs text-slate-600">
            Tente ajustar os filtros ou buscar por outro termo
          </p>
        </div>
      ) : (
        /* Licitações Cards */
        <div className="space-y-3">
              {data.map((lic) => {
            const days = daysUntil(lic.data_encerramento_proposta);
            const urgency = getUrgencyConfig(days, lic.data_encerramento_proposta);
            const priority = PRIORITY_CONFIG[lic.prioridade] || null;
            const status = STATUS_CONFIG[lic.status] || {
              label: lic.status,
              color: "text-slate-400",
              icon: null,
            };
            const phase = PHASE_CONFIG[lic.review_phase] || {
              label: lic.review_phase || "Nova",
              color: "bg-slate-600",
            };

            return (
              <div
                key={lic.id}
                onClick={() => router.push(`/licitacoes/${lic.id}`)}
                className="block group cursor-pointer"
              >
                <div
                  className={`relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5
                  ${priority?.border || "border-slate-800/60"} 
                  bg-gradient-to-r from-slate-900/80 to-slate-900/40 
                  hover:from-slate-800/80 hover:to-slate-900/60
                  hover:border-indigo-500/30`}
                >
                  {/* Priority indicator bar */}
                  {priority && (
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${priority.bg.replace("/10", "/60")}`}
                    />
                  )}

                  <div className="flex items-stretch">
                    {/* Main content */}
                    <div className="flex-1 p-4 pl-5">
                      {/* Top row: Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {priority && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priority.color} ${priority.bg}`}
                          >
                            {priority.icon}
                            {lic.prioridade}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.color} bg-slate-800/60`}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white/80 ${phase.color}`}
                        >
                          {phase.label}
                        </span>
                        {lic.amostra_exigida && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-amber-300 bg-amber-900/30">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Amostra
                          </span>
                        )}
                        {lic.tipo_participacao === "ME/EPP" && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-cyan-300 bg-cyan-900/30">
                            ME/EPP
                          </span>
                        )}
                      </div>

                      {/* Object */}
                      <h3 className="text-sm font-medium text-slate-200 line-clamp-2 group-hover:text-white transition-colors leading-relaxed">
                        {lic.objeto_compra}
                      </h3>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span className="max-w-[200px] truncate">
                            {lic.orgao_nome}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {lic.municipio
                            ? `${lic.municipio}/${lic.uf}`
                            : lic.uf}
                        </span>
                        {lic.modalidade_contratacao && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            {lic.modalidade_contratacao}
                          </span>
                        )}
                        {lic.data_publicacao && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Calendar className="h-3 w-3" />
                            Pub: {formatDate(lic.data_publicacao)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side: Value + Deadline + Actions */}
                    <div className="flex shrink-0 items-center gap-4 border-l border-slate-800/40 px-5">
                      {/* Value */}
                      <div className="text-right min-w-[120px]">
                        <p className="text-lg font-bold text-white tabular-nums">
                          {formatCurrency(lic.valor_total_estimado)}
                        </p>
                        {lic.valor_itens_relevantes > 0 &&
                          lic.valor_itens_relevantes !==
                            lic.valor_total_estimado && (
                            <p className="text-[11px] text-emerald-500 mt-0.5">
                              <DollarSign className="inline h-3 w-3 -mt-0.5" />
                              {formatCurrency(lic.valor_itens_relevantes)}{" "}
                              relevante
                            </p>
                          )}
                      </div>

                      {/* Deadline */}
                      <div
                        className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[80px] ${urgency.bg}`}
                      >
                        <Clock
                          className={`h-3.5 w-3.5 ${urgency.color} mb-0.5`}
                        />
                        <span
                          className={`text-sm font-bold tabular-nums ${urgency.color}`}
                        >
                          {urgency.text}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {urgency.date}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/30 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </div>
                        {lic.numero_controle_pncp && (
                          <a
                            href={`https://pncp.gov.br/app/editais/${lic.numero_controle_pncp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            title="Ver no PNCP"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {lic.link_sistema_origem && (
                          <a
                            href={lic.link_sistema_origem}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900/30 text-emerald-400 hover:bg-emerald-800/40 transition-colors"
                            title="Site de origem"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-800/40 bg-slate-900/30 px-4 py-3">
          <p className="text-sm text-slate-500">
            Pagina{" "}
            <span className="text-white font-medium">{pagination.page}</span> de{" "}
            <span className="text-white font-medium">
              {pagination.totalPages}
            </span>
            <span className="text-slate-600 ml-2">
              ({pagination.total} resultados)
            </span>
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchData(pagination.page - 1)}
              className="h-8 w-8 p-0 border-slate-700/50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Page numbers */}
            {Array.from(
              { length: Math.min(5, pagination.totalPages) },
              (_, i) => {
                const startPage = Math.max(1, pagination.page - 2);
                const p = startPage + i;
                if (p > pagination.totalPages) return null;
                return (
                  <Button
                    key={p}
                    variant={p === pagination.page ? "default" : "outline"}
                    size="sm"
                    onClick={() => fetchData(p)}
                    className={`h-8 w-8 p-0 text-xs ${
                      p === pagination.page
                        ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-600"
                        : "border-slate-700/50"
                    }`}
                  >
                    {p}
                  </Button>
                );
              },
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchData(pagination.page + 1)}
              className="h-8 w-8 p-0 border-slate-700/50 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

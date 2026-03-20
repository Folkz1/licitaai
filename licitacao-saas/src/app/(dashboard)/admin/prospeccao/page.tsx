"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserPlus,
  Send,
  Eye,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  MessageCircle,
  X,
  Sparkles,
  RefreshCw,
  Search,
} from "lucide-react";

interface Prospect {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  email: string;
  interesse: string | null;
  status: string;
  trial_status: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  trial_days_left: number | null;
  trial_expired: boolean;
  access_token_last_sent_at: string | null;
  qualification_data: Record<string, unknown> | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string | null;
  first_access_at: string | null;
  last_access_at: string | null;
  access_count: number;
  prospect_status: string;
}

interface Stats {
  total: number;
  acessaram: number;
  ativos: number;
  expirados: number;
  convertidos: number;
}

interface ProspeccaoData {
  prospects: Prospect[];
  stats: Stats;
}

interface TrialResult {
  success: boolean;
  prospect: {
    leadId: string;
    nome: string;
    empresa: string;
    email: string;
    tempPassword: string;
  };
  accessLink: string;
  whatsappSent: boolean;
  error?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  enviado: {
    label: "Enviado",
    color: "text-slate-400",
    bg: "bg-slate-500/15",
    border: "border-slate-500/20",
  },
  acessou: {
    label: "Acessou",
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/20",
  },
  ativo: {
    label: "Ativo",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/20",
  },
  expirado: {
    label: "Expirado",
    color: "text-red-400",
    bg: "bg-red-500/15",
    border: "border-red-500/20",
  },
  convertido: {
    label: "Convertido",
    color: "text-emerald-300",
    bg: "bg-emerald-500/20",
    border: "border-emerald-400/30",
  },
};

const SEGMENTOS = [
  "Papel e celulose",
  "Tecnologia",
  "Saude",
  "Construcao civil",
  "Alimentos",
  "Limpeza e conservacao",
  "Material de escritorio",
  "Equipamentos medicos",
  "Veiculos e pecas",
  "Uniformes e EPIs",
  "Mobiliario",
  "Servicos de engenharia",
  "Servicos de TI",
  "Manutencao predial",
  "Educacao",
  "Outro",
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atras`;
  if (diffH < 24) return `${diffH}h atras`;
  if (diffD < 30) return `${diffD}d atras`;
  return date.toLocaleDateString("pt-BR");
}

function formatTrialExpiry(daysLeft: number | null, expired: boolean): string {
  if (expired) return "Expirado";
  if (daysLeft === null) return "-";
  if (daysLeft === 0) return "Hoje";
  if (daysLeft === 1) return "Amanha";
  return `${daysLeft} dias`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    const ddd = cleaned.slice(2, 4);
    const number = cleaned.slice(4);
    if (number.length === 9) {
      return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
    }
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  return phone;
}

function waLink(phone: string | null): string {
  if (!phone) return "#";
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}`;
}

export default function ProspeccaoPage() {
  const [data, setData] = useState<ProspeccaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trialResult, setTrialResult] = useState<TrialResult | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: "",
    empresa: "",
    segmento: "",
    uf: "",
    telefone: "",
    email: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/prospeccao");
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const json = await res.json();
      setData(json);
    } catch {
      // handle silently
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    setTrialResult(null);

    try {
      const res = await fetch("/api/admin/prospeccao/criar-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error || "Erro ao criar trial");
        setSubmitting(false);
        return;
      }

      setTrialResult(json);
      setForm({ nome: "", empresa: "", segmento: "", uf: "", telefone: "", email: "" });
      fetchData();
    } catch {
      setFormError("Erro de conexao. Tente novamente.");
    }
    setSubmitting(false);
  }

  function handleCopyLink(link: string, prospectId: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(prospectId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const filteredProspects = data?.prospects.filter((p) => {
    const matchSearch =
      !searchTerm ||
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.empresa || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === "todos" || p.prospect_status === filterStatus;

    return matchSearch && matchStatus;
  });

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-sm text-slate-500">Carregando prospeccao...</p>
        </div>
      </div>
    );
  }

  const stats = data.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Prospeccao Ativa
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie trials presente e acompanhe conversoes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={() => {
              setShowModal(true);
              setTrialResult(null);
              setFormError(null);
            }}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
          >
            <UserPlus className="h-4 w-4" />
            Novo Trial Presente
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total enviados"
          value={stats.total}
          icon={<Send className="h-4 w-4" />}
          iconColor="text-slate-400"
          iconBg="bg-slate-500/10"
        />
        <StatCard
          label="Acessaram"
          value={stats.acessaram}
          icon={<Eye className="h-4 w-4" />}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          label="Ativos (3 dias)"
          value={stats.ativos}
          icon={<Activity className="h-4 w-4" />}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          label="Expirados"
          value={stats.expirados}
          icon={<Clock className="h-4 w-4" />}
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
        />
        <StatCard
          label="Convertidos"
          value={stats.convertidos}
          icon={<CheckCircle2 className="h-4 w-4" />}
          iconColor="text-emerald-300"
          iconBg="bg-emerald-500/10"
          highlight
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, empresa ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-800/60 bg-slate-900/80 pl-9 pr-4 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          {["todos", "enviado", "acessou", "ativo", "expirado", "convertido"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                filterStatus === status
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-slate-800/50 text-slate-500 border border-slate-800/60 hover:text-slate-300"
              }`}
            >
              {status === "todos" ? "Todos" : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 overflow-hidden">
        {filteredProspects && filteredProspects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/60">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Empresa
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Segmento
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Acessos
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Ultimo acesso
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Trial expira
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredProspects.map((prospect) => {
                  const statusCfg = STATUS_CONFIG[prospect.prospect_status] || STATUS_CONFIG.enviado;
                  const segmento = prospect.qualification_data
                    ? (prospect.qualification_data as Record<string, string>).segmento || "-"
                    : prospect.interesse || "-";
                  const uf = prospect.qualification_data
                    ? (prospect.qualification_data as Record<string, string>).uf || ""
                    : "";

                  return (
                    <tr
                      key={prospect.id}
                      className="hover:bg-slate-800/20 transition-colors"
                    >
                      {/* Empresa */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-200 truncate max-w-[180px]">
                          {prospect.empresa || "-"}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Criado {formatRelativeDate(prospect.created_at)}
                        </p>
                      </td>

                      {/* Contato */}
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-300 truncate max-w-[160px]">
                          {prospect.nome}
                        </p>
                        <p className="text-[11px] text-slate-600 truncate max-w-[160px]">
                          {prospect.email}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {formatPhone(prospect.telefone)}
                        </p>
                      </td>

                      {/* Segmento */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-400 truncate max-w-[140px]">
                          {segmento}
                        </p>
                        {uf && (
                          <span className="inline-block mt-0.5 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {uf}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}
                        >
                          {prospect.prospect_status === "ativo" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Acessos */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-white">
                          {prospect.access_count}
                        </span>
                      </td>

                      {/* Ultimo acesso */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-400">
                          {formatRelativeDate(prospect.last_access_at)}
                        </p>
                      </td>

                      {/* Trial expira */}
                      <td className="px-4 py-3">
                        <p
                          className={`text-xs font-medium ${
                            prospect.trial_expired
                              ? "text-red-400"
                              : prospect.trial_days_left !== null && prospect.trial_days_left <= 2
                                ? "text-amber-400"
                                : "text-slate-400"
                          }`}
                        >
                          {formatTrialExpiry(prospect.trial_days_left, prospect.trial_expired)}
                        </p>
                        {prospect.trial_expires_at && (
                          <p className="text-[10px] text-slate-600">
                            {new Date(prospect.trial_expires_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </td>

                      {/* Acoes */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {prospect.telefone && (
                            <a
                              href={waLink(prospect.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver no WhatsApp"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() =>
                              handleCopyLink(
                                `${window.location.origin}/acesso/${prospect.id}`,
                                prospect.id
                              )
                            }
                            title="Copiar link de acesso"
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                              copiedId === prospect.id
                                ? "bg-indigo-500/20 text-indigo-300"
                                : "bg-slate-800/50 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300"
                            }`}
                          >
                            {copiedId === prospect.id ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/50 mb-4">
              <UserPlus className="h-8 w-8 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500 text-center max-w-md">
              {searchTerm || filterStatus !== "todos"
                ? "Nenhum prospect encontrado com esses filtros."
                : "Nenhum trial presente enviado ainda. Clique em 'Novo Trial Presente' para comecar a prospectar."}
            </p>
          </div>
        )}
      </div>

      {/* Modal: Novo Trial Presente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-slate-800/60 bg-slate-950 shadow-2xl shadow-black/40">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15">
                  <UserPlus className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Novo Trial Presente</h2>
                  <p className="text-[11px] text-slate-500">
                    Cria workspace + envia link via WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5">
              {trialResult && trialResult.success ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <p className="text-sm font-semibold text-emerald-300">
                        Trial criado com sucesso!
                      </p>
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>
                        <span className="text-slate-500">Empresa:</span>{" "}
                        {trialResult.prospect.empresa}
                      </p>
                      <p>
                        <span className="text-slate-500">Email:</span>{" "}
                        {trialResult.prospect.email}
                      </p>
                      <p>
                        <span className="text-slate-500">Senha temporaria:</span>{" "}
                        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-amber-300">
                          {trialResult.prospect.tempPassword}
                        </code>
                      </p>
                      <p>
                        <span className="text-slate-500">WhatsApp:</span>{" "}
                        {trialResult.whatsappSent ? (
                          <span className="text-emerald-400">Enviado com sucesso</span>
                        ) : (
                          <span className="text-amber-400">Nao enviado (envie manualmente)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium">Link de acesso:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={trialResult.accessLink}
                        className="flex-1 rounded-lg border border-slate-800/60 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(trialResult.accessLink);
                        }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={trialResult.accessLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTrialResult(null);
                      setShowModal(false);
                    }}
                    className="w-full rounded-lg bg-slate-800/80 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2">
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                      <p className="text-xs text-red-300">{formError}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Nome *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                        placeholder="Nome do contato"
                        className="w-full rounded-lg border border-slate-800/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.empresa}
                        onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                        placeholder="Nome da empresa"
                        className="w-full rounded-lg border border-slate-800/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Segmento *
                      </label>
                      <select
                        required
                        value={form.segmento}
                        onChange={(e) => setForm({ ...form, segmento: e.target.value })}
                        className="w-full rounded-lg border border-slate-800/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      >
                        <option value="" className="bg-slate-950 text-slate-500">
                          Selecione...
                        </option>
                        {SEGMENTOS.map((s) => (
                          <option key={s} value={s} className="bg-slate-950">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        UF *
                      </label>
                      <select
                        required
                        value={form.uf}
                        onChange={(e) => setForm({ ...form, uf: e.target.value })}
                        className="w-full rounded-lg border border-slate-800/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      >
                        <option value="" className="bg-slate-950 text-slate-500">
                          Selecione...
                        </option>
                        {UFS.map((u) => (
                          <option key={u} value={u} className="bg-slate-950">
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Telefone (WhatsApp) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={form.telefone}
                        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                        placeholder="(11) 99999-9999"
                        className="w-full rounded-lg border border-slate-800/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="email@empresa.com"
                        className="w-full rounded-lg border border-slate-800/60 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Criar e Enviar
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Stat Card */
function StatCard({
  label,
  value,
  icon,
  iconColor,
  iconBg,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-all hover:shadow-lg ${
        highlight
          ? "border-emerald-600/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-950/50 hover:shadow-emerald-500/5"
          : "border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/50 hover:shadow-indigo-500/5"
      }`}
    >
      <div className={`absolute -right-3 -top-3 h-12 w-12 rounded-full blur-2xl opacity-20 ${iconBg}`} />
      <div className="flex items-center gap-3 relative">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div>
          <p className={`text-xl font-bold ${highlight ? "text-emerald-300" : "text-white"}`}>
            {value}
          </p>
          <p className="text-[11px] text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

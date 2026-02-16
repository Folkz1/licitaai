"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
<<<<<<< HEAD
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
=======
>>>>>>> master
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Plus,
  X,
  Search,
  Clock,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Calendar,
<<<<<<< HEAD
  Settings,
  Trash2,
  Save,
  Bot,
=======
  Sparkles,
  Save,
  Trash2,
  Edit2,
  MapPin,
  Power,
>>>>>>> master
} from "lucide-react";

interface SearchConfig {
  id: number;
  nome: string;
<<<<<<< HEAD
  ufs: string[];
  modalidades_contratacao: number[];
  dias_retroativos: number;
  valor_minimo: number;
  valor_maximo: number | null;
  ativo: boolean;
  source: string;
  buscar_srp: boolean;
  buscar_me_epp: boolean;
  created_at: string;
}

interface Keyword {
  id: number;
=======
  modalidades_contratacao: number[];
  ufs: string[];
  dias_retroativos: number;
  valor_minimo: number;
  valor_maximo: number | null;
  buscar_srp: boolean;
  buscar_me_epp: boolean;
  ativa: boolean;
  source: string;
}

interface Keyword {
  id: string;
>>>>>>> master
  palavra: string;
  tipo: "INCLUSAO" | "EXCLUSAO";
  peso: number;
}

interface Schedule {
  id: string;
<<<<<<< HEAD
  config_id: number;
=======
>>>>>>> master
  workflow: string;
  enabled: boolean;
  frequency: string;
  hour: number;
  minute: number;
  days_of_week: number[];
  params: Record<string, unknown>;
  last_run_at: string | null;
  last_status: string | null;
  next_run_at: string | null;
  run_count: number;
}

<<<<<<< HEAD
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MODALIDADES = [
  { value: 1, label: "Pregão Eletrônico" },
  { value: 2, label: "Concorrência" },
  { value: 6, label: "Dispensa" },
  { value: 8, label: "Credenciamento" },
  { value: 9, label: "Pregão Presencial" },
  { value: 10, label: "RDC" },
];
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export default function ConfiguracoesPage() {
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordType, setKeywordType] = useState<"INCLUSAO" | "EXCLUSAO">("INCLUSAO");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SearchConfig | null>(null);
  const [editingPromptType, setEditingPromptType] = useState<string | null>(null);
  const [promptContent, setPromptContent] = useState("");
  const [configForm, setConfigForm] = useState({
    nome: "",
    ufs: [] as string[],
    modalidades: [] as number[],
    dias_retroativos: 15,
    valor_minimo: 0,
    valor_maximo: null as number | null,
    buscar_srp: true,
    buscar_me_epp: true,
  });
=======
interface CustomPrompt {
  id: string;
  prompt_type: string;
  content: string;
  is_active: boolean;
  updated_at: string;
}

const PROMPT_LABELS: Record<string, { title: string; description: string }> = {
  PRE_TRIAGEM: {
    title: "Prompt de Pre-Triagem",
    description: "Contexto da empresa usado pela IA para classificar rapidamente se uma licitacao e relevante antes da analise completa.",
  },
  ANALISE_COMPLETA: {
    title: "Prompt de Analise Completa",
    description: "Contexto detalhado da empresa usado pela IA para analisar editais, extrair itens relevantes e calcular prioridade.",
  },
  OUTPUT_SCHEMA: {
    title: "Schema de Saida JSON",
    description: "Estrutura JSON que a IA deve retornar. Inclua campos_customizados para dados especificos do seu segmento. O frontend renderiza automaticamente.",
  },
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const WORKFLOW_LABELS: Record<string, string> = {
  BUSCA_PNCP: "Busca PNCP",
  ANALISE_EDITAIS: "Analise de Editais",
};

const ALL_UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const MODALIDADES_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Leilao" },
  { value: 2, label: "Dialogo Competitivo" },
  { value: 3, label: "Concurso" },
  { value: 4, label: "Concorrencia" },
  { value: 5, label: "Pre-qualificacao" },
  { value: 6, label: "Pregao Eletronico" },
  { value: 7, label: "Credenciamento" },
  { value: 8, label: "Dispensa" },
  { value: 9, label: "Manifestacao de Interesse" },
  { value: 12, label: "Cotacao Eletronica" },
  { value: 13, label: "Ato Especial" },
];

const EMPTY_CONFIG: Omit<SearchConfig, "id" | "source"> = {
  nome: "",
  modalidades_contratacao: [6, 8],
  ufs: [],
  dias_retroativos: 15,
  valor_minimo: 0,
  valor_maximo: null,
  buscar_srp: true,
  buscar_me_epp: true,
  ativa: true,
};

export default function ConfiguracoesPage() {
  const [buscaConfigs, setBuscaConfigs] = useState<SearchConfig[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordType, setKeywordType] = useState<"INCLUSAO" | "EXCLUSAO">("INCLUSAO");
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("agendamento");
  const [editingConfig, setEditingConfig] = useState<Partial<SearchConfig> | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);
>>>>>>> master

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
<<<<<<< HEAD
    const [configsRes, keywordsRes, schedulesRes, promptsRes] = await Promise.all([
      fetch("/api/configuracoes"),
      fetch("/api/configuracoes/keywords"),
      fetch("/api/configuracoes/schedules"),
      fetch("/api/configuracoes/prompts"),
    ]);
    if (configsRes.ok) {
      const data = await configsRes.json();
      setConfigs(data.config || []);
    }
    if (keywordsRes.ok) {
      setKeywords(await keywordsRes.json());
=======
    const [configRes, schedulesRes, buscaRes] = await Promise.all([
      fetch("/api/configuracoes"),
      fetch("/api/configuracoes/schedules"),
      fetch("/api/configuracoes/busca"),
    ]);
    if (configRes.ok) {
      const data = await configRes.json();
      setKeywords(data.keywords || []);
      setPrompts(data.prompts || []);
      const editState: Record<string, string> = {};
      for (const p of (data.prompts || []) as CustomPrompt[]) {
        editState[p.prompt_type] = p.content;
      }
      setEditingPrompts(editState);
>>>>>>> master
    }
    if (schedulesRes.ok) {
      setSchedules(await schedulesRes.json());
    }
<<<<<<< HEAD
    if (promptsRes.ok) {
      setPrompts(await promptsRes.json());
=======
    if (buscaRes.ok) {
      setBuscaConfigs(await buscaRes.json());
>>>>>>> master
    }
    setLoading(false);
  }

<<<<<<< HEAD
  async function savePrompt() {
    if (!editingPromptType || !promptContent) return;
    setSaving(true);
    await fetch("/api/configuracoes/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_type: editingPromptType, content: promptContent }),
    });
    setSaving(false);
    setEditingPromptType(null);
    setPromptContent("");
    fetchAll();
=======
  async function refreshKeywords() {
    const res = await fetch("/api/configuracoes");
    if (res.ok) {
      const data = await res.json();
      setKeywords(data.keywords || []);
    }
  }

  async function saveBuscaConfig() {
    if (!editingConfig?.nome?.trim()) return;
    setSaving("busca");
    const method = editingConfig.id ? "PUT" : "POST";
    await fetch("/api/configuracoes/busca", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingConfig),
    });
    setEditingConfig(null);
    setShowConfigForm(false);
    const res = await fetch("/api/configuracoes/busca");
    if (res.ok) setBuscaConfigs(await res.json());
    setSaving(null);
  }

  async function deleteBuscaConfig(id: number) {
    await fetch(`/api/configuracoes/busca?id=${id}`, { method: "DELETE" });
    const res = await fetch("/api/configuracoes/busca");
    if (res.ok) setBuscaConfigs(await res.json());
  }

  async function toggleBuscaConfig(config: SearchConfig) {
    await fetch("/api/configuracoes/busca", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, ativa: !config.ativa }),
    });
    const res = await fetch("/api/configuracoes/busca");
    if (res.ok) setBuscaConfigs(await res.json());
>>>>>>> master
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return;
    await fetch("/api/configuracoes/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ palavra: newKeyword, tipo: keywordType }),
    });
    setNewKeyword("");
<<<<<<< HEAD
    fetchAll();
  }

  async function removeKeyword(id: number) {
    await fetch(`/api/configuracoes/keywords?id=${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function saveConfig() {
    setSaving(true);
    const url = editingConfig ? "/api/configuracoes" : "/api/configuracoes";
    const method = editingConfig ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingConfig?.id,
        ...configForm,
      }),
    });
    setSaving(false);
    setDialogOpen(false);
    setEditingConfig(null);
    setConfigForm({ nome: "", ufs: [], modalidades: [], dias_retroativos: 15, valor_minimo: 0, valor_maximo: null, buscar_srp: true, buscar_me_epp: true });
    fetchAll();
  }

  async function deleteConfig(id: number) {
    if (!confirm("Tem certeza que deseja excluir esta configuração?")) return;
    await fetch(`/api/configuracoes?id=${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function toggleConfigAtivo(config: SearchConfig) {
    await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, ativo: !config.ativo }),
    });
    fetchAll();
  }

  async function saveSchedule(schedule: Schedule) {
    setSaving(true);
=======
    refreshKeywords();
  }

  async function removeKeyword(id: string) {
    await fetch(`/api/configuracoes/keywords?id=${id}`, { method: "DELETE" });
    refreshKeywords();
  }

  async function saveSchedule(schedule: Schedule) {
    setSaving(schedule.workflow);
>>>>>>> master
    await fetch("/api/configuracoes/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
<<<<<<< HEAD
    setSaving(false);
    fetchAll();
  }

  function updateSchedule(workflow: string, configId: number, updates: Partial<Schedule>) {
    setSchedules((prev) =>
      prev.map((s) => (s.workflow === workflow && s.config_id === configId ? { ...s, ...updates } : s))
    );
  }

  function toggleDay(workflow: string, configId: number, day: number) {
    const schedule = schedules.find((s) => s.workflow === workflow && s.config_id === configId);
=======
    await fetchAll();
    setSaving(null);
  }

  function updateSchedule(workflow: string, updates: Partial<Schedule>) {
    setSchedules((prev) =>
      prev.map((s) => (s.workflow === workflow ? { ...s, ...updates } : s))
    );
  }

  async function savePrompt(promptType: string) {
    const content = editingPrompts[promptType];
    if (!content?.trim()) return;
    setSaving(promptType);
    await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_type: promptType, content }),
    });
    await fetchAll();
    setSaving(null);
  }

  function toggleDay(workflow: string, day: number) {
    const schedule = schedules.find((s) => s.workflow === workflow);
>>>>>>> master
    if (!schedule) return;
    const days = schedule.days_of_week.includes(day)
      ? schedule.days_of_week.filter((d) => d !== day)
      : [...schedule.days_of_week, day].sort();
<<<<<<< HEAD
    updateSchedule(workflow, configId, { days_of_week: days });
  }

  function openEditDialog(config: SearchConfig) {
    setEditingConfig(config);
    setConfigForm({
      nome: config.nome,
      ufs: config.ufs || [],
      modalidades: config.modalidades_contratacao || [],
      dias_retroativos: config.dias_retroativos || 15,
      valor_minimo: config.valor_minimo || 0,
      valor_maximo: config.valor_maximo,
      buscar_srp: config.buscar_srp ?? true,
      buscar_me_epp: config.buscar_me_epp ?? true,
    });
    setDialogOpen(true);
  }

  async function createScheduleForConfig(configId: number, workflow: string) {
    await fetch("/api/configuracoes/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config_id: configId,
        workflow,
        enabled: true,
        frequency: "DAILY",
        hour: workflow === "BUSCA_PNCP" ? 6 : 8,
        minute: 0,
        days_of_week: [1, 2, 3, 4, 5],
        params: workflow === "ANALISE_EDITAIS" ? { max_licitacoes: 10 } : {},
      }),
    });
    fetchAll();
=======
    updateSchedule(workflow, { days_of_week: days });
>>>>>>> master
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const inclusao = keywords.filter((k) => k.tipo === "INCLUSAO");
  const exclusao = keywords.filter((k) => k.tipo === "EXCLUSAO");

  return (
    <div className="space-y-6">
<<<<<<< HEAD
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <Button
          onClick={() => {
            setEditingConfig(null);
            setConfigForm({ nome: "", ufs: [], modalidades: [], dias_retroativos: 15, valor_minimo: 0, valor_maximo: null, buscar_srp: true, buscar_me_epp: true });
            setDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-500"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Configuração
        </Button>
      </div>

      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="configs">Configurações de Busca</TabsTrigger>
          <TabsTrigger value="keywords">Palavras-chave</TabsTrigger>
          <TabsTrigger value="prompts">
            <Bot className="h-4 w-4 mr-1" /> Prompts IA
          </TabsTrigger>
        </TabsList>

        {/* Search Configs Tab */}
        <TabsContent value="configs" className="space-y-4">
          {configs.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="py-10 text-center text-slate-400">
                Nenhuma configuração encontrada. Clique em "Nova Configuração" para criar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {configs.map((config) => (
                <Card key={config.id} className={`border-slate-800 bg-slate-900/50 ${!config.ativo ? "opacity-50" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base text-white">
                        <Settings className="h-4 w-4 text-indigo-400" />
                        {config.nome}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.ativo ? "default" : "outline"} className={config.ativo ? "bg-emerald-600" : ""}>
                          {config.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => toggleConfigAtivo(config)}>
                          {config.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(config)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteConfig(config.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Config Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">UFs:</span>
                        <span className="ml-2 text-slate-300">{(config.ufs || []).join(", ") || "Todas"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Modalidades:</span>
                        <span className="ml-2 text-slate-300">{(config.modalidades_contratacao || []).join(", ") || "Todas"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Dias retroativos:</span>
                        <span className="ml-2 text-slate-300">{config.dias_retroativos}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Valores:</span>
                        <span className="ml-2 text-slate-300">
                          {config.valor_minimo ? `R$ ${config.valor_minimo}` : "Sem mínimo"}
                          {config.valor_maximo ? ` - R$ ${config.valor_maximo}` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">SRP:</span>
                        <span className="ml-2 text-slate-300">{config.buscar_srp ? "Sim" : "Não"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">ME/EPP:</span>
                        <span className="ml-2 text-slate-300">{config.buscar_me_epp ? "Sim" : "Não"}</span>
                      </div>
                    </div>

                    {/* Schedules for this config */}
                    <div className="border-t border-slate-800 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Agendamentos
                        </h4>
                        <div className="flex gap-2">
                          {!schedules.find(s => s.config_id === config.id && s.workflow === "BUSCA_PNCP") && (
                            <Button size="sm" variant="outline" onClick={() => createScheduleForConfig(config.id, "BUSCA_PNCP")}>
                              <Plus className="mr-1 h-3 w-3" /> Busca PNCP
                            </Button>
                          )}
                          {!schedules.find(s => s.config_id === config.id && s.workflow === "ANALISE_EDITAIS") && (
                            <Button size="sm" variant="outline" onClick={() => createScheduleForConfig(config.id, "ANALISE_EDITAIS")}>
                              <Plus className="mr-1 h-3 w-3" /> Análise
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {schedules.filter(s => s.config_id === config.id).map((schedule) => (
                        <div key={schedule.workflow} className="bg-slate-800/50 rounded-lg p-3 mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">
                              {schedule.workflow === "BUSCA_PNCP" ? "🔍 Busca PNCP" : "🤖 Análise de Editais"}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={schedule.enabled ? "default" : "outline"}
                                onClick={() => {
                                  updateSchedule(schedule.workflow, config.id, { enabled: !schedule.enabled });
                                  saveSchedule({ ...schedule, enabled: !schedule.enabled });
                                }}
                                className={schedule.enabled ? "bg-emerald-600" : ""}
                              >
                                {schedule.enabled ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                                {schedule.enabled ? "Ativo" : "Pausado"}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <Label className="text-slate-500">Frequência</Label>
                              <Select
                                value={schedule.frequency}
                                onValueChange={(v) => {
                                  updateSchedule(schedule.workflow, config.id, { frequency: v });
                                }}
                              >
                                <SelectTrigger className="h-8 border-slate-700 bg-slate-800">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-800">
                                  <SelectItem value="HOURLY">Hora</SelectItem>
                                  <SelectItem value="DAILY">Diário</SelectItem>
                                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-slate-500">Hora</Label>
                              <Select
                                value={String(schedule.hour)}
                                onValueChange={(v) => {
                                  updateSchedule(schedule.workflow, config.id, { hour: parseInt(v) });
                                }}
                              >
                                <SelectTrigger className="h-8 border-slate-700 bg-slate-800">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-800">
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={String(i)}>
                                      {String(i).padStart(2, "0")}:00
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-slate-500">Dias</Label>
                              <div className="flex gap-1 mt-1">
                                {DAY_LABELS.map((label, i) => (
                                  <button
                                    key={i}
                                    onClick={() => toggleDay(schedule.workflow, config.id, i)}
                                    className={`rounded text-xs px-1.5 py-0.5 ${
                                      schedule.days_of_week.includes(i) ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-2 bg-slate-700 hover:bg-slate-600"
                            onClick={() => saveSchedule(schedule)}
                            disabled={saving}
                          >
                            <Save className="mr-2 h-3 w-3" /> Salvar Agendamento
                          </Button>
                        </div>
                      ))}
                      
                      {schedules.filter(s => s.config_id === config.id).length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-2">
                          Nenhum agendamento. Clique nos botões acima para adicionar.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
=======
      <h1 className="text-2xl font-bold">Configuracoes</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="agendamento">Agendamento</TabsTrigger>
          <TabsTrigger value="keywords">Palavras-chave</TabsTrigger>
          <TabsTrigger value="prompts">Prompts IA</TabsTrigger>
          <TabsTrigger value="busca">Busca</TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="agendamento" className="space-y-4">
          {schedules.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="py-10 text-center text-slate-400">
                Nenhum agendamento configurado. Execute a migration 002_cron_schedules.sql
              </CardContent>
            </Card>
          ) : (
            schedules.map((schedule) => (
              <Card key={schedule.workflow} className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-base text-white">
                      <Clock className="h-5 w-5 text-indigo-400" />
                      {WORKFLOW_LABELS[schedule.workflow] || schedule.workflow}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {schedule.last_status && (
                        <Badge
                          variant={schedule.last_status === "SUCCESS" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {schedule.last_status === "SUCCESS" ? (
                            <CheckCircle className="mr-1 h-3 w-3" />
                          ) : (
                            <AlertTriangle className="mr-1 h-3 w-3" />
                          )}
                          {schedule.last_status === "SUCCESS" ? "OK" : "Erro"}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant={schedule.enabled ? "default" : "outline"}
                        className={schedule.enabled ? "bg-emerald-600 hover:bg-emerald-500" : ""}
                        onClick={() => {
                          const updated = { ...schedule, enabled: !schedule.enabled };
                          updateSchedule(schedule.workflow, { enabled: !schedule.enabled });
                          saveSchedule(updated);
                        }}
                      >
                        {schedule.enabled ? (
                          <>
                            <Play className="mr-1 h-3 w-3" /> Ativo
                          </>
                        ) : (
                          <>
                            <Pause className="mr-1 h-3 w-3" /> Pausado
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Frequency */}
                    <div>
                      <Label className="text-slate-400">Frequencia</Label>
                      <Select
                        value={schedule.frequency}
                        onValueChange={(v) => updateSchedule(schedule.workflow, { frequency: v })}
                      >
                        <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-800">
                          <SelectItem value="HOURLY">A cada hora</SelectItem>
                          <SelectItem value="DAILY">Diario</SelectItem>
                          <SelectItem value="WEEKLY">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Hour */}
                    <div>
                      <Label className="text-slate-400">Hora</Label>
                      <Select
                        value={String(schedule.hour)}
                        onValueChange={(v) => updateSchedule(schedule.workflow, { hour: parseInt(v) })}
                      >
                        <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-800 max-h-60">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {String(i).padStart(2, "0")}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Minute */}
                    <div>
                      <Label className="text-slate-400">Minuto</Label>
                      <Select
                        value={String(schedule.minute)}
                        onValueChange={(v) => updateSchedule(schedule.workflow, { minute: parseInt(v) })}
                      >
                        <SelectTrigger className="border-slate-700 bg-slate-800 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-800">
                          {[0, 15, 30, 45].map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              :{String(m).padStart(2, "0")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Days of week */}
                  <div>
                    <Label className="text-slate-400">Dias da semana</Label>
                    <div className="mt-1 flex gap-2">
                      {DAY_LABELS.map((label, i) => (
                        <button
                          key={i}
                          onClick={() => toggleDay(schedule.workflow, i)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            schedule.days_of_week.includes(i)
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Workflow-specific params */}
                  {schedule.workflow === "ANALISE_EDITAIS" && (
                    <div>
                      <Label className="text-slate-400">Max licitacoes por execucao</Label>
                      <Input
                        type="number"
                        value={(schedule.params as { max_licitacoes?: number })?.max_licitacoes || 10}
                        onChange={(e) =>
                          updateSchedule(schedule.workflow, {
                            params: { ...schedule.params, max_licitacoes: parseInt(e.target.value) || 10 },
                          })
                        }
                        className="mt-1 w-32 border-slate-700 bg-slate-800 text-white"
                      />
                    </div>
                  )}

                  {/* Info row */}
                  <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
                    {schedule.last_run_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Ultima: {new Date(schedule.last_run_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                    {schedule.next_run_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Proxima: {new Date(schedule.next_run_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                    <span>Execucoes: {schedule.run_count}</span>
                  </div>

                  {/* Save button */}
                  <Button
                    onClick={() => saveSchedule(schedule)}
                    disabled={saving === schedule.workflow}
                    className="bg-indigo-600 hover:bg-indigo-500"
                  >
                    {saving === schedule.workflow ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Salvar Agendamento
                  </Button>
                </CardContent>
              </Card>
            ))
>>>>>>> master
          )}
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="flex gap-2 pt-4">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Nova palavra-chave..."
                className="border-slate-700 bg-slate-800 text-white"
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              />
              <Button
                variant={keywordType === "INCLUSAO" ? "default" : "destructive"}
                onClick={() => setKeywordType(keywordType === "INCLUSAO" ? "EXCLUSAO" : "INCLUSAO")}
                className="shrink-0"
              >
                {keywordType === "INCLUSAO" ? <Search className="mr-1 h-4 w-4" /> : <X className="mr-1 h-4 w-4" />}
<<<<<<< HEAD
                {keywordType === "INCLUSAO" ? "Inclusão" : "Exclusão"}
=======
                {keywordType === "INCLUSAO" ? "Inclusao" : "Exclusao"}
>>>>>>> master
              </Button>
              <Button onClick={addKeyword} className="shrink-0 bg-indigo-600 hover:bg-indigo-500">
                <Plus className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-emerald-400">
<<<<<<< HEAD
                  <Search className="h-4 w-4" /> Inclusão ({inclusao.length})
=======
                  <Search className="h-4 w-4" /> Inclusao ({inclusao.length})
>>>>>>> master
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {inclusao.map((k) => (
                    <Badge
                      key={k.id}
                      className="cursor-pointer bg-emerald-900/50 text-emerald-300 hover:bg-red-900/50"
                      onClick={() => removeKeyword(k.id)}
                    >
                      {k.palavra} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
<<<<<<< HEAD
                  {inclusao.length === 0 && <span className="text-slate-500 text-sm">Nenhuma palavra</span>}
=======
>>>>>>> master
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-red-400">
<<<<<<< HEAD
                  <X className="h-4 w-4" /> Exclusão ({exclusao.length})
=======
                  <X className="h-4 w-4" /> Exclusao ({exclusao.length})
>>>>>>> master
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {exclusao.map((k) => (
                    <Badge
                      key={k.id}
                      className="cursor-pointer bg-red-900/50 text-red-300 hover:bg-slate-700"
                      onClick={() => removeKeyword(k.id)}
                    >
                      {k.palavra} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
<<<<<<< HEAD
                  {exclusao.length === 0 && <span className="text-slate-500 text-sm">Nenhuma palavra</span>}
=======
>>>>>>> master
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

<<<<<<< HEAD
        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Bot className="h-5 w-5 text-indigo-400" />
                Prompts Personalizados para IA
              </CardTitle>
              <p className="text-sm text-slate-400">
                Os prompts são gerados automaticamente com base no onboarding. Você pode editá-los para customizar o comportamento da IA.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pré-Triagem */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 font-medium">Pré-Triagem</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingPromptType("PRE_TRIAGEM");
                      setPromptContent(prompts["PRE_TRIAGEM"] || "");
                    }}
                  >
                    <Settings className="h-3 w-3 mr-1" /> Editar
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Usado para classificar licitações como "Analisar" ou "Rejeitar" antes da análise completa.
                </p>
                <pre className="text-xs bg-slate-950 p-3 rounded-lg overflow-x-auto max-h-32 text-slate-300">
                  {prompts["PRE_TRIAGEM"]?.substring(0, 500) || "Prompt não gerado ainda"}
                </pre>
              </div>

              {/* Análise Completa */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 font-medium">Análise Completa</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingPromptType("ANALISE_COMPLETA");
                      setPromptContent(prompts["ANALISE_COMPLETA"] || "");
                    }}
                  >
                    <Settings className="h-3 w-3 mr-1" /> Editar
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Usado para extrair itens, valores e informações detalhadas do edital.
                </p>
                <pre className="text-xs bg-slate-950 p-3 rounded-lg overflow-x-auto max-h-32 text-slate-300">
                  {prompts["ANALISE_COMPLETA"]?.substring(0, 500) || "Prompt não gerado ainda"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for add/edit config */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg border-slate-700 bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConfig ? "Editar Configuração" : "Nova Configuração"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400">Nome *</Label>
              <Input
                value={configForm.nome}
                onChange={(e) => setConfigForm({ ...configForm, nome: e.target.value })}
                placeholder="Ex: Buscas SP, Buscas Regionais..."
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            
            <div>
              <Label className="text-slate-400">UFs</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {UFS.map((uf) => (
                  <Button
                    key={uf}
                    size="sm"
                    variant={configForm.ufs.includes(uf) ? "default" : "outline"}
                    onClick={() => {
                      const newUfs = configForm.ufs.includes(uf)
                        ? configForm.ufs.filter((u) => u !== uf)
                        : [...configForm.ufs, uf];
                      setConfigForm({ ...configForm, ufs: newUfs });
                    }}
                    className={configForm.ufs.includes(uf) ? "bg-indigo-600" : ""}
                  >
                    {uf}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-slate-400">Modalidades</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {MODALIDADES.map((m) => (
                  <Button
                    key={m.value}
                    size="sm"
                    variant={configForm.modalidades.includes(m.value) ? "default" : "outline"}
                    onClick={() => {
                      const newMods = configForm.modalidades.includes(m.value)
                        ? configForm.modalidades.filter((v) => v !== m.value)
                        : [...configForm.modalidades, m.value];
                      setConfigForm({ ...configForm, modalidades: newMods });
                    }}
                    className={configForm.modalidades.includes(m.value) ? "bg-indigo-600" : ""}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-slate-400">Dias Retroativos</Label>
                <Input
                  type="number"
                  value={configForm.dias_retroativos}
                  onChange={(e) => setConfigForm({ ...configForm, dias_retroativos: parseInt(e.target.value) || 15 })}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-400">Valor Mínimo (R$)</Label>
                <Input
                  type="number"
                  value={configForm.valor_minimo}
                  onChange={(e) => setConfigForm({ ...configForm, valor_minimo: parseFloat(e.target.value) || 0 })}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-400">Valor Máximo (R$)</Label>
                <Input
                  type="number"
                  value={configForm.valor_maximo || ""}
                  onChange={(e) => setConfigForm({ ...configForm, valor_maximo: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Opcional"
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.buscar_srp}
                  onChange={(e) => setConfigForm({ ...configForm, buscar_srp: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Buscar SRP (Sistema de Registro de Preços)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={configForm.buscar_me_epp}
                  onChange={(e) => setConfigForm({ ...configForm, buscar_me_epp: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">Preferir ME/EPP</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveConfig} disabled={saving || !configForm.nome} className="bg-indigo-600 hover:bg-indigo-500">
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for edit prompt */}
      <Dialog open={!!editingPromptType} onOpenChange={(open) => !open && setEditingPromptType(null)}>
        <DialogContent className="max-w-3xl border-slate-700 bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPromptType === "PRE_TRIAGEM" ? "Editar Prompt de Pré-Triagem" : "Editar Prompt de Análise Completa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Use as variáveis <code className="bg-slate-800 px-1 rounded">&#123;&#123; $json.campo &#125;&#125;</code> para inserir dados dinâmicos.
            </p>
            <div>
              <Label className="text-slate-400">Conteúdo do Prompt</Label>
              <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                className="w-full h-96 border-slate-700 bg-slate-800 text-white text-sm p-4 rounded-lg font-mono"
                placeholder="Digite o prompt..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPromptType(null)}>Cancelar</Button>
            <Button onClick={savePrompt} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
=======
        {/* Prompts IA Tab */}
        <TabsContent value="prompts" className="space-y-4">
          {(["PRE_TRIAGEM", "ANALISE_COMPLETA", "OUTPUT_SCHEMA"] as const).map((type) => {
            const meta = PROMPT_LABELS[type];
            const dbPrompt = prompts.find((p) => p.prompt_type === type);
            const hasChanges = editingPrompts[type] !== (dbPrompt?.content || "");
            return (
              <Card key={type} className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    {meta.title}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    value={editingPrompts[type] || ""}
                    onChange={(e) => setEditingPrompts((prev) => ({ ...prev, [type]: e.target.value }))}
                    rows={10}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                    placeholder={`Nenhum prompt configurado. Complete o onboarding ou escreva um prompt personalizado aqui.`}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-600">
                      {dbPrompt?.updated_at
                        ? `Atualizado: ${new Date(dbPrompt.updated_at).toLocaleString("pt-BR")}`
                        : "Nao configurado"}
                    </p>
                    <Button
                      onClick={() => savePrompt(type)}
                      disabled={saving === type || !hasChanges}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-500"
                    >
                      {saving === type ? (
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-3 w-3" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Search Config Tab */}
        <TabsContent value="busca" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Configure buscas diferentes para cada conjunto de estados e modalidades.
            </p>
            <Button
              onClick={() => {
                setEditingConfig({ ...EMPTY_CONFIG });
                setShowConfigForm(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500"
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Nova Busca
            </Button>
          </div>

          {/* Config Form */}
          {showConfigForm && editingConfig && (
            <Card className="border-indigo-500/30 bg-slate-900/80">
              <CardHeader>
                <CardTitle className="text-sm text-white">
                  {editingConfig.id ? "Editar Configuracao" : "Nova Configuracao de Busca"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-400">Nome</Label>
                  <Input
                    value={editingConfig.nome || ""}
                    onChange={(e) => setEditingConfig({ ...editingConfig, nome: e.target.value })}
                    placeholder="Ex: Busca MG/SP - Pregao"
                    className="border-slate-700 bg-slate-800 text-white"
                  />
                </div>

                <div>
                  <Label className="text-slate-400">Estados (UFs) - vazio = todos</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {ALL_UFS.map((uf) => {
                      const selected = editingConfig.ufs?.includes(uf);
                      return (
                        <button
                          key={uf}
                          onClick={() => {
                            const ufs = editingConfig.ufs || [];
                            setEditingConfig({
                              ...editingConfig,
                              ufs: selected ? ufs.filter((u) => u !== uf) : [...ufs, uf],
                            });
                          }}
                          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                          }`}
                        >
                          {uf}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-slate-400">Modalidades</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {MODALIDADES_OPTIONS.map((mod) => {
                      const selected = editingConfig.modalidades_contratacao?.includes(mod.value);
                      return (
                        <button
                          key={mod.value}
                          onClick={() => {
                            const mods = editingConfig.modalidades_contratacao || [];
                            setEditingConfig({
                              ...editingConfig,
                              modalidades_contratacao: selected
                                ? mods.filter((m) => m !== mod.value)
                                : [...mods, mod.value],
                            });
                          }}
                          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                          }`}
                        >
                          {mod.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-slate-400">Dias Retroativos</Label>
                    <Input
                      type="number"
                      value={editingConfig.dias_retroativos ?? 15}
                      onChange={(e) => setEditingConfig({ ...editingConfig, dias_retroativos: parseInt(e.target.value) || 15 })}
                      className="border-slate-700 bg-slate-800 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Valor Minimo (R$)</Label>
                    <Input
                      type="number"
                      value={editingConfig.valor_minimo ?? 0}
                      onChange={(e) => setEditingConfig({ ...editingConfig, valor_minimo: parseFloat(e.target.value) || 0 })}
                      className="border-slate-700 bg-slate-800 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Valor Maximo (R$)</Label>
                    <Input
                      type="number"
                      value={editingConfig.valor_maximo ?? ""}
                      onChange={(e) => setEditingConfig({ ...editingConfig, valor_maximo: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Sem limite"
                      className="border-slate-700 bg-slate-800 text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingConfig.buscar_srp ?? true}
                      onChange={(e) => setEditingConfig({ ...editingConfig, buscar_srp: e.target.checked })}
                      className="rounded border-slate-600"
                    />
                    Incluir SRP
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingConfig.buscar_me_epp ?? true}
                      onChange={(e) => setEditingConfig({ ...editingConfig, buscar_me_epp: e.target.checked })}
                      className="rounded border-slate-600"
                    />
                    Incluir ME/EPP
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    className="text-slate-400"
                    onClick={() => { setShowConfigForm(false); setEditingConfig(null); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={saveBuscaConfig}
                    disabled={saving === "busca" || !editingConfig.nome?.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500"
                  >
                    {saving === "busca" ? (
                      <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" />
                    )}
                    {editingConfig.id ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Config List */}
          {buscaConfigs.length === 0 && !showConfigForm ? (
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="py-10 text-center text-slate-400">
                Nenhuma configuracao de busca. Crie uma para comecar a monitorar licitacoes.
              </CardContent>
            </Card>
          ) : (
            buscaConfigs.map((cfg) => (
              <Card
                key={cfg.id}
                className={`border-slate-800 bg-slate-900/50 ${!cfg.ativa ? "opacity-50" : ""}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white truncate">{cfg.nome}</h3>
                        {cfg.ativa ? (
                          <Badge className="bg-emerald-900/50 text-emerald-300 text-[10px]">Ativa</Badge>
                        ) : (
                          <Badge className="bg-slate-800 text-slate-500 text-[10px]">Pausada</Badge>
                        )}
                        {cfg.source === "AI_GENERATED" && (
                          <Badge className="bg-purple-900/50 text-purple-300 text-[10px]">
                            <Sparkles className="mr-0.5 h-2.5 w-2.5" />IA
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {cfg.ufs?.length > 0 ? cfg.ufs.join(", ") : "Todos os estados"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {cfg.dias_retroativos} dias retroativos
                        </span>
                        <span>
                          Modalidades: {cfg.modalidades_contratacao?.map((m) => {
                            const mod = MODALIDADES_OPTIONS.find((o) => o.value === m);
                            return mod?.label || m;
                          }).join(", ") || "-"}
                        </span>
                      </div>

                      {(cfg.valor_minimo > 0 || cfg.valor_maximo) && (
                        <p className="text-xs text-slate-500">
                          Valor: R$ {cfg.valor_minimo?.toLocaleString("pt-BR") || "0"} - {cfg.valor_maximo ? `R$ ${cfg.valor_maximo.toLocaleString("pt-BR")}` : "sem limite"}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-400"
                        onClick={() => {
                          setEditingConfig({ ...cfg });
                          setShowConfigForm(true);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-7 w-7 p-0 ${cfg.ativa ? "text-emerald-500 hover:text-amber-400" : "text-slate-500 hover:text-emerald-400"}`}
                        onClick={() => toggleBuscaConfig(cfg)}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                        onClick={() => deleteBuscaConfig(cfg.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
>>>>>>> master
    </div>
  );
}

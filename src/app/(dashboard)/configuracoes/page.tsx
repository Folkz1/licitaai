"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
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
  Settings,
  Trash2,
  Save,
  Bot,
} from "lucide-react";

interface SearchConfig {
  id: number;
  nome: string;
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
  palavra: string;
  tipo: "INCLUSAO" | "EXCLUSAO";
  peso: number;
}

interface Schedule {
  id: string;
  config_id: number;
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

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
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
    }
    if (schedulesRes.ok) {
      setSchedules(await schedulesRes.json());
    }
    if (promptsRes.ok) {
      setPrompts(await promptsRes.json());
    }
    setLoading(false);
  }

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
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return;
    await fetch("/api/configuracoes/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ palavra: newKeyword, tipo: keywordType }),
    });
    setNewKeyword("");
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
    await fetch("/api/configuracoes/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
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
    if (!schedule) return;
    const days = schedule.days_of_week.includes(day)
      ? schedule.days_of_week.filter((d) => d !== day)
      : [...schedule.days_of_week, day].sort();
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
                {keywordType === "INCLUSAO" ? "Inclusão" : "Exclusão"}
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
                  <Search className="h-4 w-4" /> Inclusão ({inclusao.length})
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
                  {inclusao.length === 0 && <span className="text-slate-500 text-sm">Nenhuma palavra</span>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-red-400">
                  <X className="h-4 w-4" /> Exclusão ({exclusao.length})
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
                  {exclusao.length === 0 && <span className="text-slate-500 text-sm">Nenhuma palavra</span>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sparkles,
  Save,
  Trash2,
  Edit2,
  MapPin,
  Power,
} from "lucide-react";

interface SearchConfig {
  id: number;
  nome: string;
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
  palavra: string;
  tipo: "INCLUSAO" | "EXCLUSAO";
  peso: number;
}

interface Schedule {
  id: string;
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

interface CustomField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean";
}

function OutputSchemaEditor({
  prompts,
  saving,
  onSave,
}: {
  prompts: CustomPrompt[];
  saving: string | null;
  onSave: (content: string) => Promise<void>;
}) {
  const dbPrompt = prompts.find((p) => p.prompt_type === "OUTPUT_SCHEMA");

  // Parse existing schema to extract campos_customizados
  const parseFields = (): CustomField[] => {
    if (!dbPrompt?.content) return [];
    try {
      const schema = JSON.parse(dbPrompt.content);
      const custom = schema.campos_customizados || {};
      return Object.entries(custom).map(([key, val]) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        type: typeof val === "number" ? "number" : typeof val === "boolean" ? "boolean" : "text",
      }));
    } catch {
      return [];
    }
  };

  const [fields, setFields] = useState<CustomField[]>(parseFields);
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "boolean">("text");
  const [hasChanges, setHasChanges] = useState(false);

  function addField() {
    const key = newFieldKey
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!key || fields.some((f) => f.key === key)) return;
    setFields([...fields, { key, label: newFieldKey.trim(), type: newFieldType }]);
    setNewFieldKey("");
    setHasChanges(true);
  }

  function removeField(key: string) {
    setFields(fields.filter((f) => f.key !== key));
    setHasChanges(true);
  }

  function buildSchema(): string {
    const custom: Record<string, string | number | boolean> = {};
    for (const f of fields) {
      if (f.type === "number") custom[f.key] = 0;
      else if (f.type === "boolean") custom[f.key] = false;
      else custom[f.key] = "";
    }

    // Merge with existing base schema or create new
    let base: Record<string, unknown> = {};
    try {
      if (dbPrompt?.content) base = JSON.parse(dbPrompt.content);
    } catch { /* ignore */ }

    return JSON.stringify({ ...base, campos_customizados: custom }, null, 2);
  }

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Sparkles className="h-5 w-5 text-purple-400" />
          Campos Personalizados (Saida IA)
        </CardTitle>
        <p className="text-xs text-slate-500">
          Defina campos especificos do seu segmento que a IA deve preencher na analise. Esses campos aparecem como &quot;Dados Especificos&quot; na pagina de detalhes.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current fields */}
        {fields.length > 0 ? (
          <div className="space-y-2">
            {fields.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{f.label}</span>
                  <Badge className="bg-slate-700 text-slate-300 text-[10px]">{f.key}</Badge>
                  <Badge
                    className={`text-[10px] ${
                      f.type === "number"
                        ? "bg-blue-900/50 text-blue-300"
                        : f.type === "boolean"
                          ? "bg-amber-900/50 text-amber-300"
                          : "bg-emerald-900/50 text-emerald-300"
                    }`}
                  >
                    {f.type === "text" ? "Texto" : f.type === "number" ? "Numero" : "Sim/Nao"}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                  onClick={() => removeField(f.key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 py-6 text-center text-sm text-slate-500">
            Nenhum campo personalizado. Adicione campos abaixo.
          </div>
        )}

        {/* Add new field */}
        <div className="flex items-end gap-2 rounded-lg border border-slate-700/30 bg-slate-800/30 p-3">
          <div className="flex-1">
            <Label className="text-xs text-slate-400">Nome do campo</Label>
            <Input
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
              placeholder="Ex: tipo_equipamento"
              className="border-slate-700 bg-slate-800 text-white text-sm h-9"
              onKeyDown={(e) => e.key === "Enter" && addField()}
            />
          </div>
          <div className="w-32">
            <Label className="text-xs text-slate-400">Tipo</Label>
            <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as "text" | "number" | "boolean")}>
              <SelectTrigger className="border-slate-700 bg-slate-800 text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-700 bg-slate-800">
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="number">Numero</SelectItem>
                <SelectItem value="boolean">Sim/Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addField} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-500" disabled={!newFieldKey.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-slate-600">
            {dbPrompt?.updated_at
              ? `Atualizado: ${new Date(dbPrompt.updated_at).toLocaleString("pt-BR")}`
              : "Nao configurado"}
          </p>
          <Button
            onClick={() => onSave(buildSchema())}
            disabled={saving === "OUTPUT_SCHEMA" || !hasChanges}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            {saving === "OUTPUT_SCHEMA" ? (
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1 h-3 w-3" />
            )}
            Salvar Campos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
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
    }
    if (schedulesRes.ok) {
      setSchedules(await schedulesRes.json());
    }
    if (buscaRes.ok) {
      setBuscaConfigs(await buscaRes.json());
    }
    setLoading(false);
  }

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
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return;
    await fetch("/api/configuracoes/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ palavra: newKeyword, tipo: keywordType }),
    });
    setNewKeyword("");
    refreshKeywords();
  }

  async function removeKeyword(id: string) {
    await fetch(`/api/configuracoes/keywords?id=${id}`, { method: "DELETE" });
    refreshKeywords();
  }

  async function saveSchedule(schedule: Schedule) {
    setSaving(schedule.workflow);
    await fetch("/api/configuracoes/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
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
    if (!schedule) return;
    const days = schedule.days_of_week.includes(day)
      ? schedule.days_of_week.filter((d) => d !== day)
      : [...schedule.days_of_week, day].sort();
    updateSchedule(workflow, { days_of_week: days });
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
      <h1 className="text-2xl font-bold">Configuracoes</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="agendamento">Agendamento</TabsTrigger>
          <TabsTrigger value="keywords">Palavras-chave</TabsTrigger>
          <TabsTrigger value="prompts">Prompts IA</TabsTrigger>
          <TabsTrigger value="busca">Busca</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys</TabsTrigger>
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
                {keywordType === "INCLUSAO" ? "Inclusao" : "Exclusao"}
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
                  <Search className="h-4 w-4" /> Inclusao ({inclusao.length})
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
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-red-400">
                  <X className="h-4 w-4" /> Exclusao ({exclusao.length})
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Prompts IA Tab */}
        <TabsContent value="prompts" className="space-y-4">
          {(["PRE_TRIAGEM", "ANALISE_COMPLETA"] as const).map((type) => {
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

          {/* OUTPUT_SCHEMA - Form-based editor */}
          <OutputSchemaEditor
            prompts={prompts}
            saving={saving}
            onSave={async (content: string) => {
              setSaving("OUTPUT_SCHEMA");
              await fetch("/api/configuracoes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt_type: "OUTPUT_SCHEMA", content }),
              });
              await fetchAll();
              setSaving(null);
            }}
          />
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

        {/* API Keys Tab */}
        <TabsContent value="apikeys" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/10">
                <Power className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">API Keys</h3>
              <p className="text-sm text-slate-400 max-w-md">
                Em breve voce podera gerar chaves de API para integrar o LicitaAI com seus sistemas externos, ERPs e ferramentas de automacao.
              </p>
              <Badge className="mt-4 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
                Em breve
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

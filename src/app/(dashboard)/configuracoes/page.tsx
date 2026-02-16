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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Copy,
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
  created_at: string;
}

interface Keyword {
  id: number;
  palavra: string;
  tipo: "INCLUSAO" | "EXCLUSAO";
  peso: number;
  categoria: string | null;
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

export default function ConfiguracoesPage() {
  const [configs, setConfigs] = useState<SearchConfig[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordType, setKeywordType] = useState<"INCLUSAO" | "EXCLUSAO">("INCLUSAO");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SearchConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    nome: "",
    ufs: [] as string[],
    modalidades: [] as number[],
    dias_retroativos: 15,
    valor_minimo: 0,
    valor_maximo: null as number | null,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [configsRes, keywordsRes, schedulesRes] = await Promise.all([
      fetch("/api/configuracoes"),
      fetch("/api/configuracoes/keywords"),
      fetch("/api/configuracoes/schedules"),
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
    setLoading(false);
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
    await fetch("/api/configuracoes", {
      method: editingConfig ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingConfig?.id,
        ...configForm,
      }),
    });
    setSaving(false);
    setDialogOpen(false);
    setEditingConfig(null);
    setConfigForm({ nome: "", ufs: [], modalidades: [], dias_retroativos: 15, valor_minimo: 0, valor_maximo: null });
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
    });
    setDialogOpen(true);
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
            setConfigForm({ nome: "", ufs: [], modalidades: [], dias_retroativos: 15, valor_minimo: 0, valor_maximo: null });
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
            <div className="grid gap-4 md:grid-cols-2">
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
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
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
                    </div>
                    
                    {/* Schedule for this config */}
                    {schedules.filter(s => s.config_id === config.id).map((schedule) => (
                      <div key={schedule.workflow} className="rounded bg-slate-800/50 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{schedule.workflow}</span>
                          <span className="text-slate-500">
                            {schedule.hour.toString().padStart(2, "0")}:{schedule.minute.toString().padStart(2, "0")} ({schedule.frequency})
                          </span>
                        </div>
                      </div>
                    ))}
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
      </Tabs>

      {/* Dialog for add/edit config */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-slate-700 bg-slate-900">
          <DialogHeader>
            <DialogTitle>{editingConfig ? "Editar Configuração" : "Nova Configuração"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400">Nome</Label>
              <Input
                value={configForm.nome}
                onChange={(e) => setConfigForm({ ...configForm, nome: e.target.value })}
                placeholder="Ex: Buscas SP, Buscas Regionais..."
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400">UFs (separadas por vírgula)</Label>
              <Input
                value={configForm.ufs.join(", ")}
                onChange={(e) => setConfigForm({ ...configForm, ufs: e.target.value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) })}
                placeholder="SP, RJ, MG..."
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400">Modalidades</Label>
              <div className="flex flex-wrap gap-2 mt-1">
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
                <Label className="text-slate-400">Valor Mínimo</Label>
                <Input
                  type="number"
                  value={configForm.valor_minimo}
                  onChange={(e) => setConfigForm({ ...configForm, valor_minimo: parseFloat(e.target.value) || 0 })}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-400">Valor Máximo</Label>
                <Input
                  type="number"
                  value={configForm.valor_maximo || ""}
                  onChange={(e) => setConfigForm({ ...configForm, valor_maximo: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Opcional"
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveConfig} disabled={saving || !configForm.nome} className="bg-indigo-600 hover:bg-indigo-500">
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

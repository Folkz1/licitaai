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
} from "lucide-react";

interface SearchConfig {
  id: string;
  modalidades: string[];
  ufs: string[];
  dias_retroativos: number;
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

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const WORKFLOW_LABELS: Record<string, string> = {
  BUSCA_PNCP: "Busca PNCP",
  ANALISE_EDITAIS: "Analise de Editais",
};

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordType, setKeywordType] = useState<"INCLUSAO" | "EXCLUSAO">("INCLUSAO");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [configRes, schedulesRes] = await Promise.all([
      fetch("/api/configuracoes"),
      fetch("/api/configuracoes/schedules"),
    ]);
    if (configRes.ok) {
      const data = await configRes.json();
      setConfig(data.config);
      setKeywords(data.keywords || []);
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

  async function removeKeyword(id: string) {
    await fetch(`/api/configuracoes/keywords?id=${id}`, { method: "DELETE" });
    fetchAll();
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

      <Tabs defaultValue="agendamento" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="agendamento">Agendamento</TabsTrigger>
          <TabsTrigger value="keywords">Palavras-chave</TabsTrigger>
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

        {/* Search Config Tab */}
        <TabsContent value="busca">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-sm text-slate-300">Configuracao de Busca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {config ? (
                <>
                  <div>
                    <Label className="text-slate-400">Modalidades</Label>
                    <p className="text-sm text-slate-300">
                      {Array.isArray(config.modalidades) ? config.modalidades.join(", ") : String(config.modalidades || "-")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-400">UFs</Label>
                    <p className="text-sm text-slate-300">
                      {Array.isArray(config.ufs) ? config.ufs.join(", ") : String(config.ufs || "-")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-400">Dias Retroativos</Label>
                    <p className="text-sm text-slate-300">{config.dias_retroativos || "-"}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">Nenhuma configuracao encontrada.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

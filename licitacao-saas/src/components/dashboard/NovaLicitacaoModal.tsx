"use client";

import { useState, useRef } from "react";
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
  X,
  Upload,
  FileText,
  Brain,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const MODALIDADES = [
  "Pregão Eletrônico",
  "Pregão Presencial",
  "Concorrência",
  "Tomada de Preços",
  "Convite",
  "Concurso",
  "Leilão",
  "Dispensa de Licitação",
  "Inexigibilidade",
  "Outro",
];

interface NovaLicitacaoModalProps {
  onClose: () => void;
  onSuccess: (id: string) => void;
}

type Step = "form" | "analyzing" | "done";

interface FormState {
  orgao_nome: string;
  objeto_compra: string;
  valor_total_estimado: string;
  uf: string;
  municipio: string;
  modalidade_contratacao: string;
  tipo_participacao: string;
  data_encerramento_proposta: string;
  link_sistema_origem: string;
  numero_controle_pncp: string;
  informacao_complementar: string;
}

export function NovaLicitacaoModal({ onClose, onSuccess }: NovaLicitacaoModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>({
    orgao_nome: "",
    objeto_compra: "",
    valor_total_estimado: "",
    uf: "",
    municipio: "",
    modalidade_contratacao: "",
    tipo_participacao: "",
    data_encerramento_proposta: "",
    link_sistema_origem: "",
    numero_controle_pncp: "",
    informacao_complementar: "",
  });
  const [editalText, setEditalText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<"none" | "text" | "file">("none");
  const [saving, setSaving] = useState(false);
  const [analyzeAfterSave, setAnalyzeAfterSave] = useState(false);
  const [result, setResult] = useState<{ prioridade?: string; review_phase?: string; error?: string } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("Criando licitação...");
  const fileRef = useRef<HTMLInputElement>(null);

  function setField(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(andAnalyze: boolean) {
    if (!form.orgao_nome.trim() || !form.objeto_compra.trim()) return;

    setSaving(true);
    setAnalyzeAfterSave(andAnalyze);

    try {
      // 1. Create licitação
      const res = await fetch("/api/licitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valor_total_estimado: form.valor_total_estimado
            ? parseFloat(form.valor_total_estimado.replace(/\./g, "").replace(",", "."))
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao salvar");
        setSaving(false);
        return;
      }

      const id = data.id;
      setCreatedId(id);

      if (!andAnalyze) {
        onSuccess(id);
        return;
      }

      // 2. Trigger analysis
      setStep("analyzing");
      setProgressMsg("Analisando com IA...");

      let analyzeRes: Response;

      if (inputMode === "file" && file) {
        setProgressMsg("Enviando arquivo para OCR...");
        const fd = new FormData();
        fd.append("file", file);
        analyzeRes = await fetch(`/api/licitacoes/${id}/analyze`, {
          method: "POST",
          body: fd,
        });
      } else if (inputMode === "text" && editalText.trim().length > 10) {
        setProgressMsg("Analisando edital...");
        analyzeRes = await fetch(`/api/licitacoes/${id}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edital_text: editalText }),
        });
      } else {
        // Analyze by objeto only
        setProgressMsg("Analisando pelo objeto da compra...");
        analyzeRes = await fetch(`/api/licitacoes/${id}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }

      const analyzeData = await analyzeRes.json();
      setResult(analyzeData);
      setStep("done");
      onSuccess(id);
    } catch (err) {
      alert("Erro inesperado: " + (err instanceof Error ? err.message : "desconhecido"));
      setSaving(false);
    }
  }

  const prioridadeConfig: Record<string, { label: string; color: string }> = {
    P1: { label: "Alta Prioridade", color: "text-red-400" },
    P2: { label: "Média Prioridade", color: "text-amber-400" },
    P3: { label: "Baixa Prioridade", color: "text-blue-400" },
    REJEITAR: { label: "Rejeitada", color: "text-slate-400" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Nova Licitação Manual</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Analyzing step */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
            <div className="relative">
              <Brain className="h-12 w-12 text-indigo-400" />
              <Loader2 className="absolute -top-1 -right-1 h-5 w-5 animate-spin text-indigo-300" />
            </div>
            <p className="text-slate-300 font-medium">{progressMsg}</p>
            <p className="text-xs text-slate-500">Isso pode levar até 2 minutos...</p>
          </div>
        )}

        {/* Done step */}
        {step === "done" && result && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
            {result.error ? (
              <>
                <AlertTriangle className="h-12 w-12 text-amber-400" />
                <p className="text-amber-300 font-medium">Análise falhou</p>
                <p className="text-xs text-slate-400">{result.error}</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                <p className="text-emerald-300 font-medium text-lg">Análise concluída!</p>
                {result.prioridade && (
                  <span className={`text-2xl font-bold ${prioridadeConfig[result.prioridade]?.color || "text-white"}`}>
                    {result.prioridade} — {prioridadeConfig[result.prioridade]?.label}
                  </span>
                )}
              </>
            )}
            <Button
              className="mt-4 bg-indigo-600 hover:bg-indigo-700"
              onClick={onClose}
            >
              Ver na lista
            </Button>
          </div>
        )}

        {/* Form step */}
        {step === "form" && (
          <div className="px-6 py-5 space-y-5">
            {/* Required */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Informações Básicas *</p>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Órgão / Entidade *</label>
                <Input
                  value={form.orgao_nome}
                  onChange={(e) => setField("orgao_nome", e.target.value)}
                  placeholder="Ex: Prefeitura Municipal de São Paulo"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Objeto da Compra *</label>
                <textarea
                  value={form.objeto_compra}
                  onChange={(e) => setField("objeto_compra", e.target.value)}
                  placeholder="Descreva o objeto da licitação..."
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Detalhes</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Valor Estimado (R$)</label>
                  <Input
                    value={form.valor_total_estimado}
                    onChange={(e) => setField("valor_total_estimado", e.target.value)}
                    placeholder="Ex: 150000"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Encerramento</label>
                  <Input
                    type="date"
                    value={form.data_encerramento_proposta}
                    onChange={(e) => setField("data_encerramento_proposta", e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Estado (UF)</label>
                  <Select value={form.uf || "NONE"} onValueChange={(v) => setField("uf", v === "NONE" ? "" : v)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-sm text-white">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-800">
                      <SelectItem value="NONE">Não informado</SelectItem>
                      {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Município</label>
                  <Input
                    value={form.municipio}
                    onChange={(e) => setField("municipio", e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Modalidade</label>
                  <Select value={form.modalidade_contratacao || "NONE"} onValueChange={(v) => setField("modalidade_contratacao", v === "NONE" ? "" : v)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-sm text-white">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-800">
                      <SelectItem value="NONE">Não informado</SelectItem>
                      {MODALIDADES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo Participação</label>
                  <Select value={form.tipo_participacao || "NONE"} onValueChange={(v) => setField("tipo_participacao", v === "NONE" ? "" : v)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-sm text-white">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-800">
                      <SelectItem value="NONE">Não informado</SelectItem>
                      <SelectItem value="ABERTA">Aberta</SelectItem>
                      <SelectItem value="ME/EPP">ME/EPP</SelectItem>
                      <SelectItem value="RESTRITA">Restrita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Link do Sistema / Edital</label>
                <Input
                  value={form.link_sistema_origem}
                  onChange={(e) => setField("link_sistema_origem", e.target.value)}
                  placeholder="https://..."
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Número PNCP / Protocolo (opcional)</label>
                <Input
                  value={form.numero_controle_pncp}
                  onChange={(e) => setField("numero_controle_pncp", e.target.value)}
                  placeholder="Ex: 12345678000190-1-000123/2025"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            {/* Edital content */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Conteúdo do Edital (para análise mais precisa)</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode(inputMode === "text" ? "none" : "text")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    inputMode === "text"
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Colar texto
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode(inputMode === "file" ? "none" : "file")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    inputMode === "file"
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload PDF
                </button>
                {inputMode === "none" && (
                  <span className="flex items-center text-xs text-slate-500 ml-1">
                    ↑ Sem edital: IA analisa só pelo objeto
                  </span>
                )}
              </div>

              {inputMode === "text" && (
                <textarea
                  value={editalText}
                  onChange={(e) => setEditalText(e.target.value)}
                  placeholder="Cole aqui o conteúdo do edital, TR, minuta ou qualquer documento relevante..."
                  rows={6}
                  className="w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
                />
              )}

              {inputMode === "file" && (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/30 p-6 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors"
                  >
                    {file ? (
                      <>
                        <FileText className="h-8 w-8 text-indigo-400" />
                        <p className="text-sm text-white font-medium">{file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB — clique para trocar</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-slate-500" />
                        <p className="text-sm text-slate-400">Clique para selecionar PDF ou DOC</p>
                        <p className="text-xs text-slate-500">O arquivo será enviado para OCR antes da análise</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <Button variant="ghost" onClick={onClose} className="text-slate-400">
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={saving || !form.orgao_nome.trim() || !form.objeto_compra.trim()}
                  className="border-slate-600 text-slate-300 hover:text-white"
                >
                  {saving && !analyzeAfterSave ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={saving || !form.orgao_nome.trim() || !form.objeto_compra.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                >
                  {saving && analyzeAfterSave
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Brain className="h-4 w-4" />
                  }
                  Salvar e Analisar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

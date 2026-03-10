"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Upload,
  FileText,
  Brain,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
} from "lucide-react";

interface NovaLicitacaoModalProps {
  onClose: () => void;
  onSuccess: (id: string) => void;
}

type Step = "form" | "analyzing" | "done";

export function NovaLicitacaoModal({ onClose, onSuccess }: NovaLicitacaoModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [editalText, setEditalText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [linkOrigem, setLinkOrigem] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [orgaoNome, setOrgaoNome] = useState("");
  const [objetoCompra, setObjetoCompra] = useState("");
  const [saving, setSaving] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<{
    id?: string;
    prioridade?: string;
    review_phase?: string;
    error?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasEdital = (inputMode === "file" && files.length > 0) || (inputMode === "text" && editalText.trim().length > 50);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  async function handleAnalyze() {
    if (!hasEdital) return;

    setSaving(true);
    setStep("analyzing");
    setProgressMsg(inputMode === "file" ? `Enviando ${files.length} arquivo(s) para OCR...` : "Preparando análise...");

    try {
      // Single POST that creates + analyzes
      const fd = new FormData();

      if (inputMode === "file" && files.length > 0) {
        files.forEach((f) => fd.append("files", f));
      } else if (inputMode === "text") {
        fd.append("edital_text", editalText);
      }

      // Optional extras
      if (linkOrigem.trim()) fd.append("link_sistema_origem", linkOrigem.trim());
      if (orgaoNome.trim()) fd.append("orgao_nome", orgaoNome.trim());
      if (objetoCompra.trim()) fd.append("objeto_compra", objetoCompra.trim());

      setProgressMsg("Analisando edital com IA...");

      const res = await fetch("/api/licitacoes/analisar-edital", {
        method: "POST",
        body: fd,
      });

      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        setResult({ error: `Erro no servidor (${res.status}). Tente novamente em alguns segundos.` });
        setStep("done");
        return;
      }

      if (!res.ok) {
        const errorMsg = (data.error as string) || "Erro ao analisar";
        setResult({ error: errorMsg });
        setStep("done");
        toast.error("Erro na análise do edital", { description: errorMsg.slice(0, 150) });
        return;
      }

      const prioridade = data.prioridade as string;
      setResult({
        id: data.id as string,
        prioridade,
        review_phase: data.review_phase as string,
      });
      setStep("done");

      // Toast notification based on priority
      if (prioridade === "P1") {
        toast.warning("P1 — Alta Prioridade!", {
          description: "Licitação requer ação imediata. Verifique prazos e requisitos.",
          duration: 10000,
        });
      } else if (prioridade === "REJEITAR") {
        toast.info("Licitação classificada como Não Relevante", {
          duration: 5000,
        });
      } else {
        toast.success(`Análise concluída — ${prioridade}`, {
          description: prioridadeConfig[prioridade]?.label || "Prioridade definida",
          duration: 5000,
        });
      }

      if (data.id) onSuccess(data.id as string);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro inesperado";
      setResult({ error: errorMsg });
      setStep("done");
      toast.error("Erro na análise", { description: errorMsg });
    }
  }

  function handleViewResult() {
    if (result?.id) {
      router.push(`/licitacoes/${result.id}`);
    }
    onClose();
  }

  const prioridadeConfig: Record<string, { label: string; color: string; bg: string }> = {
    P1: { label: "Alta Prioridade", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
    P2: { label: "Média Prioridade", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
    P3: { label: "Baixa Prioridade", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
    REJEITAR: { label: "Não Relevante", color: "text-slate-400", bg: "bg-slate-500/20 border-slate-500/30" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Analisar Edital</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Analyzing */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
            <div className="relative">
              <Brain className="h-14 w-14 text-indigo-400 animate-pulse" />
              <Loader2 className="absolute -top-1 -right-1 h-5 w-5 animate-spin text-indigo-300" />
            </div>
            <p className="text-slate-200 font-medium text-lg">{progressMsg}</p>
            <p className="text-xs text-slate-500">Isso pode levar até 2 minutos para PDFs grandes...</p>
            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && result && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
            {result.error ? (
              <>
                <AlertTriangle className="h-12 w-12 text-amber-400" />
                <p className="text-amber-300 font-medium text-lg">Erro na análise</p>
                <p className="text-sm text-slate-400 text-center max-w-sm">{result.error}</p>
                <Button variant="outline" onClick={() => { setStep("form"); setSaving(false); }} className="mt-2 border-slate-600 text-slate-300">
                  Tentar novamente
                </Button>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-14 w-14 text-emerald-400" />
                <p className="text-emerald-300 font-medium text-xl">Análise concluída!</p>
                {result.prioridade && (
                  <div className={`rounded-lg border px-6 py-3 ${prioridadeConfig[result.prioridade]?.bg || ""}`}>
                    <span className={`text-3xl font-bold ${prioridadeConfig[result.prioridade]?.color || "text-white"}`}>
                      {result.prioridade}
                    </span>
                    <span className="text-slate-300 ml-3 text-lg">
                      {prioridadeConfig[result.prioridade]?.label}
                    </span>
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
                    Fechar
                  </Button>
                  <Button onClick={handleViewResult} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
                    <FileText className="h-4 w-4" />
                    Ver análise completa
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <div className="px-6 py-5 space-y-5">
            {/* Main: edital input */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-white">Envie o edital para análise</p>
              <p className="text-xs text-slate-400">
                A IA extrai automaticamente todos os dados: órgão, objeto, itens, prazos, valores e prioridade.
              </p>

              {/* Toggle file/text */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode("file")}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    inputMode === "file"
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("text")}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    inputMode === "text"
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Colar texto
                </button>
              </div>

              {/* File upload — multiple files */}
              {inputMode === "file" && (
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.rar,.zip,.7z,.txt,.rtf,.csv"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); addFiles(e.dataTransfer.files); }}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/30 p-6 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-slate-500" />
                    <p className="text-sm text-slate-300">Arraste arquivos aqui ou clique para selecionar</p>
                    <p className="text-xs text-slate-500">PDF, DOC, XLS, RAR, ZIP, TXT — múltiplos arquivos aceitos</p>
                  </div>

                  {/* File list */}
                  {files.length > 0 && (
                    <div className="space-y-1.5">
                      {files.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2">
                          <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span className="text-sm text-white truncate flex-1">{f.name}</span>
                          <span className="text-xs text-slate-500 shrink-0">{formatSize(f.size)}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <p className="text-xs text-slate-500">
                        {files.length} arquivo(s) — {formatSize(files.reduce((s, f) => s + f.size, 0))} total
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Text paste */}
              {inputMode === "text" && (
                <div>
                  <textarea
                    value={editalText}
                    onChange={(e) => setEditalText(e.target.value)}
                    placeholder="Cole aqui o conteúdo completo do edital, TR, minuta ou qualquer documento relevante..."
                    rows={8}
                    className="w-full rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-y"
                  />
                  {editalText.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {editalText.length.toLocaleString("pt-BR")} caracteres
                      {editalText.length < 50 && " — mínimo 50 caracteres"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Link da origem (always visible, compact) */}
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <LinkIcon className="h-3 w-3" />
                Link da licitação (opcional)
              </label>
              <Input
                value={linkOrigem}
                onChange={(e) => setLinkOrigem(e.target.value)}
                placeholder="https://compras.gov.br/... ou URL do portal"
                className="bg-slate-800 border-slate-700 text-white text-sm"
              />
            </div>

            {/* Expandable extras */}
            <div>
              <button
                type="button"
                onClick={() => setShowExtras(!showExtras)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showExtras ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Informações adicionais (opcional)
              </button>
              {showExtras && (
                <div className="mt-3 space-y-3 pl-1">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Órgão / Entidade</label>
                    <Input
                      value={orgaoNome}
                      onChange={(e) => setOrgaoNome(e.target.value)}
                      placeholder="Se não informar, a IA extrai do edital"
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Objeto da Compra</label>
                    <Input
                      value={objetoCompra}
                      onChange={(e) => setObjetoCompra(e.target.value)}
                      placeholder="Se não informar, a IA extrai do edital"
                      className="bg-slate-800 border-slate-700 text-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <Button variant="ghost" onClick={onClose} className="text-slate-400">
                Cancelar
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={saving || !hasEdital}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2 px-6 py-2.5 text-base"
              >
                <Brain className="h-5 w-5" />
                Analisar com IA
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

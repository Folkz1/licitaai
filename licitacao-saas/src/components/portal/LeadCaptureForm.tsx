"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";

interface LeadCaptureFormProps {
  sourceSlug?: string;
  sourceUrl?: string;
  compact?: boolean;
}

interface AnalysisPreview {
  prioridade: string;
  score: number;
  justificativa: string;
}

export default function LeadCaptureForm({
  sourceSlug,
  sourceUrl,
  compact,
}: LeadCaptureFormProps) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [preview, setPreview] = useState<AnalysisPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    const form = new FormData(e.currentTarget);
    const data = {
      nome: form.get("nome") as string,
      email: form.get("email") as string,
      empresa: form.get("empresa") as string,
      interesse: form.get("interesse") as string,
      telefone: form.get("telefone") as string,
      source_slug: sourceSlug,
      source_url: sourceUrl || window.location.href,
      utm_source: new URLSearchParams(window.location.search).get("utm_source"),
      utm_medium: new URLSearchParams(window.location.search).get("utm_medium"),
      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign"),
    };

    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || "Erro ao enviar. Tente novamente.");
        setState("error");
        return;
      }

      const result = await res.json();
      if (result.preview) {
        setPreview(result.preview);
      }
      setState("success");
    } catch {
      setErrorMsg("Erro de conexao. Tente novamente.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-6 text-center">
        <CheckCircle className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
        <p className="font-semibold text-white">Cadastro realizado!</p>
        <p className="mt-1 text-sm text-slate-400">
          Entraremos em contato em breve. Se voce informou WhatsApp, seguimos por la.
        </p>

        {preview && (
          <div className="mt-4 rounded-lg border border-indigo-500/20 bg-indigo-950/20 p-4 text-left">
            <p className="mb-2 text-xs font-semibold text-indigo-400">
              Preview da Analise IA
            </p>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                  preview.prioridade === "P1"
                    ? "bg-red-500/15 text-red-400"
                    : preview.prioridade === "P2"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-blue-500/15 text-blue-400"
                }`}
              >
                {preview.prioridade}
              </span>
              <span className="text-xs text-slate-400">
                Score: <span className="font-semibold text-white">{preview.score}/10</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              {preview.justificativa}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/30 to-slate-950/50 p-6"
    >
      <p className="mb-1 font-semibold text-white">
        {compact ? "Receba analise gratis" : "Receba a analise completa deste edital"}
      </p>
      <p className="mb-4 text-xs text-slate-500">
        {compact
          ? "Deixe seu segmento e receba alertas comerciais mais alinhados ao seu perfil."
          : "Cadastre-se e receba insights por IA sobre esta licitacao e sobre o seu segmento."}
      </p>

      <div className="space-y-3">
        <input
          type="text"
          name="nome"
          required
          placeholder="Seu nome"
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
        />
        <input
          type="email"
          name="email"
          required
          placeholder="Seu melhor email"
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
        />
        <input
          type="text"
          name="empresa"
          placeholder="Empresa (opcional)"
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
        />
        <textarea
          name="interesse"
          required
          rows={compact ? 2 : 3}
          placeholder={
            compact
              ? "Seu interesse (ex: material hospitalar em MG)"
              : "O que sua empresa vende para o governo? Ex: papelaria, medicamentos, limpeza, manutencao predial"
          }
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
        />
        <input
          type="tel"
          name="telefone"
          placeholder="WhatsApp (opcional)"
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
        />
      </div>

      {errorMsg && <p className="mt-2 text-xs text-red-400">{errorMsg}</p>}

      <button
        type="submit"
        disabled={state === "loading"}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {state === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            Quero a analise gratis
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="mt-2 text-center text-[10px] text-slate-600">
        Seus dados estao seguros. Sem spam. Quanto mais contexto voce der, melhor fica a triagem.
      </p>
    </form>
  );
}

"use client";

import { useState } from "react";
import {
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  ExternalLink,
  Lock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Zap,
  BarChart3,
  Share2,
  Copy,
  Check,
  ChevronRight,
  Clock,
  Package,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

interface Props {
  licitacao: {
    id: string;
    numero_controle_pncp: string;
    orgao_nome: string;
    objeto_compra: string;
    valor_total_estimado: number;
    modalidade_contratacao: string;
    data_publicacao: string;
    data_encerramento_proposta: string;
    uf: string;
    municipio: string;
    link_sistema_origem: string;
    status: string;
  };
  analise: {
    prioridade: string;
    score_relevancia: number;
    justificativa: string;
    valor_itens_relevantes: number;
    amostra_exigida: boolean;
    documentos_necessarios: string;
    prazos: string;
    requisitos_tecnicos: string;
    analise_riscos: string;
  } | null;
  itemCount: number;
  itemValorTotal: number;
}

function formatCurrency(v: number) {
  if (!v) return "Nao informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function daysUntil(date: string) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function parseJson(str: string) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  P1: { label: "Prioridade Alta", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  P2: { label: "Prioridade Media", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
  P3: { label: "Prioridade Baixa", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
};

export function PublicLicitacaoView({ licitacao: lic, analise, itemCount, itemValorTotal }: Props) {
  const [copied, setCopied] = useState(false);
  const days = daysUntil(lic.data_encerramento_proposta);
  const prio = analise ? PRIORITY_CONFIG[analise.prioridade] : null;

  // Parse public docs (show first 3)
  let docs: string[] = [];
  if (analise?.documentos_necessarios) {
    const parsed = parseJson(analise.documentos_necessarios);
    docs = Array.isArray(parsed) ? parsed : [];
  }

  // Truncate justificativa
  const justPreview = analise?.justificativa
    ? analise.justificativa.slice(0, 250) + (analise.justificativa.length > 250 ? "..." : "")
    : null;

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: lic.objeto_compra?.slice(0, 80),
        text: `Licitacao: ${lic.orgao_nome} - ${formatCurrency(lic.valor_total_estimado)}`,
        url: window.location.href,
      });
    } else {
      handleCopyLink();
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/login" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <span className="text-sm font-bold text-white">L</span>
            </div>
            <span className="text-sm font-semibold text-white">LicitaIA</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartilhar
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Priority + Deadline Banner */}
        {analise && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {prio && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${prio.bg} ${prio.color}`}>
                <Zap className="h-3.5 w-3.5" />
                {prio.label}
              </span>
            )}
            {days !== null && days >= 0 && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${
                  days <= 3 ? "border-red-500/30 bg-red-500/20 text-red-400" : days <= 7 ? "border-amber-500/30 bg-amber-500/20 text-amber-400" : "border-slate-700 bg-slate-800 text-slate-300"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {days === 0 ? "Encerra hoje!" : `${days} dias restantes`}
              </span>
            )}
            {days !== null && days < 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-500">
                <Clock className="h-3.5 w-3.5" /> Encerrada
              </span>
            )}
            {analise.score_relevancia > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-3 py-1 text-sm font-medium text-indigo-400">
                <BarChart3 className="h-3.5 w-3.5" />
                Relevancia: {analise.score_relevancia}%
              </span>
            )}
          </div>
        )}

        {/* Object Title */}
        <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
          {lic.objeto_compra}
        </h1>

        {/* Metadata Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <Building2 className="mb-2 h-5 w-5 text-indigo-400" />
            <p className="text-xs text-slate-500">Orgao</p>
            <p className="mt-0.5 text-sm font-medium text-white leading-tight">{lic.orgao_nome}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <MapPin className="mb-2 h-5 w-5 text-emerald-400" />
            <p className="text-xs text-slate-500">Local</p>
            <p className="mt-0.5 text-sm font-medium text-white">{lic.municipio}/{lic.uf}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <DollarSign className="mb-2 h-5 w-5 text-amber-400" />
            <p className="text-xs text-slate-500">Valor Estimado</p>
            <p className="mt-0.5 text-sm font-medium text-white">{formatCurrency(lic.valor_total_estimado)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <Calendar className="mb-2 h-5 w-5 text-red-400" />
            <p className="text-xs text-slate-500">Encerramento</p>
            <p className="mt-0.5 text-sm font-medium text-white">{formatDate(lic.data_encerramento_proposta)}</p>
          </div>
        </div>

        {/* Extra Info */}
        <div className="mt-4 flex flex-wrap gap-2">
          {lic.modalidade_contratacao && (
            <span className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-400">
              {lic.modalidade_contratacao}
            </span>
          )}
          <span className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-400">
            Publicada em {formatDate(lic.data_publicacao)}
          </span>
          {itemCount > 0 && (
            <span className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-400">
              <Package className="mr-1 inline h-3 w-3" /> {itemCount} itens
            </span>
          )}
        </div>

        {/* Links */}
        <div className="mt-4 flex flex-wrap gap-3">
          {lic.numero_controle_pncp && (
            <a
              href={(() => { const p = lic.numero_controle_pncp.match(/^(\d+)-(\d+)-(\d+)\/(\d+)$/); return p ? `https://pncp.gov.br/app/editais/${p[1]}/${p[4]}/${p[3]}` : `https://pncp.gov.br/app/editais/${lic.numero_controle_pncp}`; })()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-800 bg-indigo-900/30 px-3 py-2 text-sm text-indigo-300 transition-colors hover:bg-indigo-900/50"
            >
              <ExternalLink className="h-4 w-4" /> Ver no PNCP
            </a>
          )}
          {lic.link_sistema_origem && (
            <a
              href={lic.link_sistema_origem}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300 transition-colors hover:bg-emerald-900/50"
            >
              <ExternalLink className="h-4 w-4" /> Portal de Origem
            </a>
          )}
        </div>

        {/* AI Analysis Section - PARTIAL (public teaser) */}
        {analise && (
          <div className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">Analise por IA</h2>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
                AUTOMATICA
              </span>
            </div>

            {/* Justificativa Preview */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="mb-2 text-sm font-medium text-slate-300">Resumo da Analise</h3>
              <p className="text-sm leading-relaxed text-slate-400">{justPreview}</p>

              {analise.amostra_exigida && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-800/50 bg-amber-900/20 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="text-sm text-amber-300">Amostra exigida nesta licitacao</span>
                </div>
              )}

              {/* Value cards */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">Valor Itens Relevantes</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {formatCurrency(analise.valor_itens_relevantes)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">Score de Relevancia</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-slate-700">
                      <div
                        className={`h-2 rounded-full ${
                          analise.score_relevancia >= 80 ? "bg-emerald-500" : analise.score_relevancia >= 60 ? "bg-amber-500" : "bg-slate-500"
                        }`}
                        style={{ width: `${analise.score_relevancia}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white">{analise.score_relevancia}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents Preview (first 3) */}
            {docs.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-300">Documentos Necessarios</h3>
                </div>
                <ul className="mt-3 space-y-2">
                  {docs.slice(0, 3).map((doc, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {doc}
                    </li>
                  ))}
                </ul>
                {docs.length > 3 && (
                  <p className="mt-2 text-xs text-slate-500">
                    +{docs.length - 3} documentos adicionais
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* GATE - CTA to sign up */}
        <div className="relative mt-8">
          {/* Blurred fake content */}
          <div className="pointer-events-none select-none" aria-hidden="true">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 opacity-40 blur-sm">
              <h3 className="text-sm font-medium text-slate-300">Analise Completa de Riscos</h3>
              <p className="mt-2 text-sm text-slate-400">Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam voluptatum dolorum quas facere nisi distinctio perspiciatis aliquam accusamus veritatis provident.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">Requisitos Tecnicos</p>
                  <p className="text-sm text-slate-400">Detalhamento completo dos requisitos...</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">Prazos Detalhados</p>
                  <p className="text-sm text-slate-400">Todas as datas e deadlines...</p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6 opacity-30 blur-sm">
              <h3 className="text-sm font-medium text-slate-300">Itens da Licitacao ({itemCount})</h3>
              <div className="mt-2 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between rounded bg-slate-800/50 p-2">
                    <span className="text-sm text-slate-400">Item {i} - Descricao do item...</span>
                    <span className="text-sm text-slate-400">R$ XXX,XX</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-slate-900/95 p-8 text-center shadow-2xl shadow-indigo-500/10 backdrop-blur-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Desbloqueie a Analise Completa</h3>
              <p className="mt-2 text-sm text-slate-400">
                Acesse analise de riscos, requisitos tecnicos, prazos detalhados, todos os {itemCount} itens e muito mais.
              </p>

              {/* Features list */}
              <div className="mt-5 space-y-2 text-left">
                {[
                  "Analise completa de riscos e oportunidades",
                  "Lista detalhada de todos os itens com valores",
                  "Requisitos tecnicos e documentos necessarios",
                  "Pipeline de gestao com fluxo de revisao",
                  "Alertas automaticos de prazo",
                  "Busca automatica por novas licitacoes",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </div>
                ))}
              </div>

              <Link
                href="/login"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-indigo-500 hover:to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20"
              >
                Comecar Agora - Gratis por 7 dias
                <ChevronRight className="h-4 w-4" />
              </Link>

              <p className="mt-3 text-xs text-slate-500">
                Planos a partir de R$197/mes. Sem cartao de credito para testar.
              </p>
            </div>
          </div>
        </div>

        {/* Footer - Marketing */}
        <div className="mt-16 border-t border-slate-800 pt-8">
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <span className="text-lg font-bold text-white">L</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white">LicitaIA</h3>
            <p className="mt-1 text-sm text-slate-400">
              Analise inteligente de licitacoes com IA. Encontre, analise e participe das melhores oportunidades.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <Zap className="mx-auto h-6 w-6 text-indigo-400" />
                <h4 className="mt-2 text-sm font-medium text-white">Busca Automatica</h4>
                <p className="mt-1 text-xs text-slate-500">
                  IA monitora o PNCP 24/7 e encontra licitacoes relevantes para sua empresa
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <BarChart3 className="mx-auto h-6 w-6 text-emerald-400" />
                <h4 className="mt-2 text-sm font-medium text-white">Analise com IA</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Editais analisados automaticamente: itens, riscos, documentos, prazos
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <Shield className="mx-auto h-6 w-6 text-amber-400" />
                <h4 className="mt-2 text-sm font-medium text-white">Gestao Completa</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Pipeline visual para gerenciar todo o processo de participacao
                </p>
              </div>
            </div>

            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:from-indigo-500 hover:to-purple-500"
            >
              <TrendingUp className="h-4 w-4" />
              Comece a ganhar licitacoes hoje
            </Link>

            <p className="mt-8 text-xs text-slate-600">
              LicitaIA v1.0 - Analise inteligente de licitacoes publicas
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

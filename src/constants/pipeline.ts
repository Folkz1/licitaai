import { FileText, Eye, ClipboardList, Gavel, FileCheck, TrendingUp, CheckCircle2 } from "lucide-react";

export const PHASES = [
  {
    key: "NOVA",
    label: "Novas",
    icon: FileText,
    color: "border-slate-500",
    bgColor: "bg-slate-500/10",
    headerBg: "bg-slate-800/50",
    description: "Licitações recém encontradas pelo sistema",
  },
  {
    key: "PRE_TRIAGEM",
    label: "Pré-Triagem",
    icon: Eye,
    color: "border-blue-500",
    bgColor: "bg-blue-500/10",
    headerBg: "bg-blue-900/30",
    description: "Avaliação inicial da IA - verificar relevância",
  },
  {
    key: "ANALISE",
    label: "Análise",
    icon: ClipboardList,
    color: "border-indigo-500",
    bgColor: "bg-indigo-500/10",
    headerBg: "bg-indigo-900/30",
    description: "Análise detalhada do edital e documentos",
  },
  {
    key: "DECISAO",
    label: "Decisão",
    icon: Gavel,
    color: "border-amber-500",
    bgColor: "bg-amber-500/10",
    headerBg: "bg-amber-900/30",
    description: "Equipe decide se vai participar",
  },
  {
    key: "PREPARACAO",
    label: "Preparação",
    icon: FileCheck,
    color: "border-purple-500",
    bgColor: "bg-purple-500/10",
    headerBg: "bg-purple-900/30",
    description: "Preparar documentos, habilitação e proposta",
  },
  {
    key: "PARTICIPANDO",
    label: "Participando",
    icon: TrendingUp,
    color: "border-emerald-500",
    bgColor: "bg-emerald-500/10",
    headerBg: "bg-emerald-900/30",
    description: "Proposta enviada - acompanhar sessão",
  },
  {
    key: "CONCLUIDA",
    label: "Concluída",
    icon: CheckCircle2,
    color: "border-green-500",
    bgColor: "bg-green-500/10",
    headerBg: "bg-green-900/30",
    description: "Processo finalizado (ganhou ou perdeu)",
  },
];

export const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  P1: { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30", label: "Alta" },
  P2: { color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30", label: "Média" },
  P3: { color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30", label: "Baixa" },
};

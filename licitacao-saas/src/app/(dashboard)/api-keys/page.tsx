"use client";

import { Badge } from "@/components/ui/badge";
import { Key, Code } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          API Keys & Billing
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie suas chaves de API e monitore o uso de creditos
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20">
          <Key className="h-10 w-10 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">API Keys & Billing</h2>
        <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
          Em breve voce podera gerar chaves de API para integrar o LicitaAI com seus sistemas externos, ERPs e ferramentas de automacao.
          O sistema de creditos e billing tambem sera disponibilizado aqui.
        </p>
        <Badge className="mt-4 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-sm px-4 py-1">
          Em breve
        </Badge>

        <div className="mt-10 rounded-xl border border-slate-800/60 bg-slate-900/30 p-6 max-w-md w-full text-left">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Code className="h-3.5 w-3.5" />
            Preview - O que esta por vir
          </h3>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              API REST para consultar licitacoes e analises
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              Sistema de creditos pay-per-use
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              Webhooks para notificacoes em tempo real
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              SDK Python e Node.js
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              Documentacao interativa da API
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

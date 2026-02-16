"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Zap,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  BarChart3,
  Code,
  ExternalLink,
  Activity,
  XCircle,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface Credits {
  balance: number;
  total_purchased: number;
  total_consumed: number;
  free_granted: number;
  effective_balance: number;
}

const PRICING = [
  { endpoint: "GET /api/v1/licitacoes", credits: 1, desc: "Listar licitações" },
  { endpoint: "GET /api/v1/licitacoes/:id", credits: 2, desc: "Detalhes + análise" },
  { endpoint: "GET /api/v1/stats", credits: 1, desc: "Estatísticas" },
  { endpoint: "GET /api/v1/usage", credits: 0, desc: "Verificar uso" },
  { endpoint: "POST /api/v1/busca", credits: 10, desc: "Disparar busca" },
  { endpoint: "POST /api/v1/analise", credits: 20, desc: "Disparar análise IA" },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [usageToday, setUsageToday] = useState({ calls: 0, credits_spent: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"]);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function fetchData() {
    try {
      const res = await fetch("/api/configuracoes/api-keys");
      const json = await res.json();
      setKeys(json.keys || []);
      setCredits(json.credits || null);
      setUsageToday(json.usage_today || { calls: 0, credits_spent: 0 });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/configuracoes/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: newKeyPermissions,
        }),
      });
      const json = await res.json();
      if (json.key) {
        setShowNewKey(json.key);
        setNewKeyName("");
        setShowCreateForm(false);
        fetchData();
      }
    } catch {
      /* ignore */
    }
    setCreating(false);
  }

  async function handleDelete(keyId: string) {
    if (!confirm("Tem certeza que deseja excluir esta API Key? Essa ação não pode ser desfeita.")) return;
    await fetch("/api/configuracoes/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_id: keyId }),
    });
    fetchData();
  }

  async function handleDeactivate(keyId: string) {
    await fetch("/api/configuracoes/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_id: keyId, action: "deactivate" }),
    });
    fetchData();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function togglePermission(perm: string) {
    setNewKeyPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            API Keys & Billing
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie suas chaves de API e monitore o uso de créditos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/v1/docs"
            target="_blank"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            <Code className="h-3.5 w-3.5" />
            API Docs
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            onClick={() => setShowCreateForm(true)}
            size="sm"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova API Key
          </Button>
        </div>
      </div>

      {/* Credits Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
              <CreditCard className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-emerald-400/70 uppercase tracking-wider">Saldo</p>
          </div>
          <p className="text-2xl font-bold text-emerald-300">
            {credits?.effective_balance.toFixed(0) || "0"}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">créditos disponíveis</p>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/50 to-slate-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
              <BarChart3 className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Consumido Total</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {credits?.total_consumed.toFixed(0) || "0"}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">créditos usados</p>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/50 to-slate-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
              <Activity className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Uso Hoje</p>
          </div>
          <p className="text-2xl font-bold text-white">{usageToday.calls}</p>
          <p className="text-[10px] text-slate-600 mt-1">{usageToday.credits_spent.toFixed(1)} créditos</p>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-gradient-to-br from-slate-900/50 to-slate-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
              <Key className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Keys Ativas</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {keys.filter((k) => k.is_active).length}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">de {keys.length} criadas</p>
        </div>
      </div>

      {/* New Key Created Alert */}
      {showNewKey && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-amber-300">Sua nova API Key foi criada!</h3>
                <p className="text-sm text-amber-400/70 mt-1">
                  Copie e guarde em um local seguro. Esta chave <strong>não será exibida novamente</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-slate-900/60 px-4 py-2.5 text-sm font-mono text-emerald-300 border border-slate-700/50">
                  {showNewKey}
                </code>
                <Button
                  onClick={() => copyToClipboard(showNewKey)}
                  size="sm"
                  variant="outline"
                  className={`border-slate-700 gap-1.5 ${copied ? "text-emerald-400 border-emerald-600" : ""}`}
                >
                  {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
              <Button
                onClick={() => setShowNewKey(null)}
                variant="ghost"
                size="sm"
                className="text-amber-500/60 hover:text-amber-400"
              >
                Entendi, pode fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="rounded-xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/20 to-slate-900/50 p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-400" />
            Criar Nova API Key
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome da Key</label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder='Ex: "Meu App", "Integração ERP"'
                className="border-slate-700/50 bg-slate-800/50 max-w-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Permissões</label>
              <div className="flex gap-2">
                {[
                  { key: "read", label: "Leitura", icon: Eye, desc: "Consultar dados" },
                  { key: "write", label: "Escrita", icon: Shield, desc: "Modificar dados" },
                  { key: "trigger", label: "Trigger", icon: Zap, desc: "Disparar workflows" },
                ].map((perm) => (
                  <button
                    key={perm.key}
                    onClick={() => togglePermission(perm.key)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      newKeyPermissions.includes(perm.key)
                        ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-300"
                        : "border-slate-700/40 bg-slate-800/30 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <perm.icon className="h-3.5 w-3.5" />
                    {perm.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 gap-1.5"
            >
              {creating ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Key className="h-3.5 w-3.5" />
              )}
              Gerar API Key
            </Button>
            <Button
              onClick={() => setShowCreateForm(false)}
              variant="ghost"
              size="sm"
              className="text-slate-400"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Suas API Keys
        </h3>

        {keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/50 p-10 text-center">
            <Key className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Nenhuma API Key criada</p>
            <p className="text-xs text-slate-600 mt-1">
              Crie uma para começar a usar a API
            </p>
          </div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-xl border p-4 transition-all ${
                k.is_active
                  ? "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/60"
                  : "border-slate-800/30 bg-slate-900/20 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      k.is_active ? "bg-indigo-500/15" : "bg-slate-800/50"
                    }`}
                  >
                    <Key
                      className={`h-4 w-4 ${
                        k.is_active ? "text-indigo-400" : "text-slate-600"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm">{k.name}</p>
                      {k.is_active ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                          Desativada
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">{k.key_prefix}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Permissions */}
                  <div className="flex gap-1">
                    {(k.permissions || []).map((p) => (
                      <span
                        key={p}
                        className="rounded-md bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  {/* Last used */}
                  <div className="text-right min-w-[120px]">
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Último uso</p>
                    <p className="text-xs text-slate-500">{formatDate(k.last_used_at)}</p>
                  </div>

                  {/* Actions */}
                  {k.is_active && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeactivate(k.id)}
                        title="Desativar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-amber-900/20 hover:text-amber-400 transition-colors"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(k.id)}
                        title="Excluir permanentemente"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {!k.is_active && (
                    <button
                      onClick={() => handleDelete(k.id)}
                      title="Excluir permanentemente"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pricing Reference */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5" />
          Tabela de Preços por Chamada
        </h3>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/40">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Endpoint</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Créditos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {PRICING.map((p) => (
                <tr key={p.endpoint} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <code className="text-xs font-mono text-indigo-300/80">{p.endpoint}</code>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{p.desc}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p.credits === 0 ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                        Grátis
                      </Badge>
                    ) : (
                      <span className="font-semibold text-white">{p.credits}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Start */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Code className="h-3.5 w-3.5" />
          Quick Start
        </h3>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 space-y-3">
          <p className="text-xs text-slate-500">Python</p>
          <pre className="rounded-lg bg-slate-950/60 border border-slate-800/40 p-4 text-xs font-mono text-slate-300 overflow-x-auto">
{`import requests

API_KEY = "sk-licitaia-sua-chave-aqui"
BASE_URL = "https://seudominio.com/api/v1"

# Listar licitações (1 crédito)
res = requests.get(
    f"{BASE_URL}/licitacoes",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"uf": "SP", "priority": "P1", "limit": 10}
)
data = res.json()
print(f"Total: {data['pagination']['total']}")
print(f"Créditos restantes: {data['_meta']['credits_remaining']}")

# Detalhes de uma licitação (2 créditos)
lic_id = data["data"][0]["id"]
detail = requests.get(
    f"{BASE_URL}/licitacoes/{lic_id}",
    headers={"Authorization": f"Bearer {API_KEY}"}
).json()
print(detail["data"]["analise"])`}
          </pre>
        </div>
      </div>

      {/* Clock */}
      <div className="rounded-xl border border-dashed border-slate-800/40 p-4 text-center">
        <Clock className="h-5 w-5 text-slate-700 mx-auto mb-2" />
        <p className="text-xs text-slate-600">
          Rate limits: {keys[0]?.rate_limit_per_minute || 60}/min • {keys[0]?.rate_limit_per_day || 5000}/dia
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Building2,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Search,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CreditCard,
} from "lucide-react";

interface Tenant {
  id: string;
  nome: string;
  segmento: string;
  ativo: boolean;
  onboarding_completed: boolean;
  user_count: string;
  licitacao_count: string;
  subscription_status: string;
  plan_name: string;
  created_at: string;
}

type FormMode = "closed" | "create" | "edit";

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>("closed");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", segmento: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants");
      const data = await res.json();
      if (Array.isArray(data)) setTenants(data);
      else setTenants([]);
    } catch {
      setTenants([]);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      setError("Nome da empresa é obrigatório");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/api/admin/tenants?id=${editId}` : "/api/admin/tenants";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao salvar");
      } else {
        setFormMode("closed");
        setEditId(null);
        setForm({ nome: "", segmento: "" });
        fetchTenants();
      }
    } catch {
      setError("Erro de conexão");
    }
    setSaving(false);
  }

  async function handleToggle(id: string, currentStatus: boolean) {
    await fetch(`/api/admin/tenants?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !currentStatus }),
    });
    fetchTenants();
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir o tenant "${nome}"? Isso removerá TODOS os dados associados.`)) return;
    await fetch(`/api/admin/tenants?id=${id}`, { method: "DELETE" });
    fetchTenants();
  }

  function openEdit(tenant: Tenant) {
    setForm({ nome: tenant.nome, segmento: tenant.segmento || "" });
    setEditId(tenant.id);
    setFormMode("edit");
    setError("");
  }

  function openCreate() {
    setForm({ nome: "", segmento: "" });
    setEditId(null);
    setFormMode("create");
    setError("");
  }

  const filtered = tenants.filter(
    (t) =>
      t.nome.toLowerCase().includes(search.toLowerCase()) ||
      (t.segmento || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Gerenciar Tenants
          </h1>
          <p className="mt-1 text-sm text-slate-500">{tenants.length} empresas cadastradas</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo Tenant
        </Button>
      </div>

      {/* Create / Edit Form */}
      {formMode !== "closed" && (
        <div className="rounded-xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/20 to-slate-900/50 p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            {formMode === "create" ? (
              <><Plus className="h-4 w-4 text-indigo-400" /> Criar Novo Tenant</>
            ) : (
              <><Edit2 className="h-4 w-4 text-amber-400" /> Editar Tenant</>
            )}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome da Empresa *</label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Clear Comunicação"
                className="border-slate-700/50 bg-slate-800/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Segmento</label>
              <Input
                value={form.segmento}
                onChange={(e) => setForm((f) => ({ ...f, segmento: e.target.value }))}
                placeholder="Ex: Gráfica, TI, Saúde..."
                className="border-slate-700/50 bg-slate-800/50"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="bg-indigo-600 hover:bg-indigo-500 gap-1.5">
              {saving ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              {formMode === "create" ? "Criar Tenant" : "Salvar Alterações"}
            </Button>
            <Button onClick={() => setFormMode("closed")} variant="ghost" size="sm" className="text-slate-400">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tenant..."
          className="pl-10 border-slate-700/50 bg-slate-800/50"
        />
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/50 p-10 text-center">
          <Building2 className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Nenhum tenant encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border p-4 transition-all ${
                t.ativo !== false
                  ? "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/60"
                  : "border-slate-800/30 bg-slate-900/20 opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
                    <Building2 className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{t.nome}</p>
                      {t.ativo === false ? (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Inativo</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Ativo</Badge>
                      )}
                      {t.plan_name && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <CreditCard className="h-2.5 w-2.5" />
                          {t.plan_name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.segmento || "Sem segmento"} • Criado em {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1" title="Usuários">
                      <Users className="h-3.5 w-3.5" /> {t.user_count || 0}
                    </span>
                    <span className="flex items-center gap-1" title="Licitações">
                      <FileText className="h-3.5 w-3.5" /> {t.licitacao_count || 0}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(t)}
                      title="Editar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-900/20 hover:text-indigo-400 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggle(t.id, t.ativo !== false)}
                      title={t.ativo !== false ? "Desativar" : "Ativar"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-amber-900/20 hover:text-amber-400 transition-colors"
                    >
                      {t.ativo !== false ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.nome)}
                      title="Excluir"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tenant ID for reference */}
              <div className="mt-2 flex items-center gap-2">
                <code className="text-[10px] text-slate-700 font-mono">{t.id}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

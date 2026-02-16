"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Users,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Eye,
  BarChart3,
  Edit2,
  Mail,
  Building2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  last_login_at: string;
  tenant_nome: string;
  tenant_id: string;
  created_at: string;
}

interface Tenant {
  id: string;
  nome: string;
}

type FormMode = "closed" | "create" | "edit";

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Shield },
  ADMIN: { label: "Admin", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: Shield },
  ANALYST: { label: "Analista", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", icon: BarChart3 },
  VIEWER: { label: "Visualizador", color: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: Eye },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>("closed");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ANALYST",
    tenantId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, tenantsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/tenants"),
      ]);
      const usersData = await usersRes.json();
      const tenantsData = await tenantsRes.json();
      if (Array.isArray(usersData)) setUsers(usersData);
      if (Array.isArray(tenantsData)) setTenants(tenantsData);
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Nome e email são obrigatórios");
      return;
    }
    if (formMode === "create" && !form.password) {
      setError("Senha é obrigatória para novo usuário");
      return;
    }
    if (formMode === "create" && !form.tenantId) {
      setError("Selecione um tenant");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (formMode === "create") {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Erro ao criar");
          setSaving(false);
          return;
        }
      } else if (editId) {
        const res = await fetch(`/api/admin/users?id=${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            role: form.role,
            tenantId: form.tenantId,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Erro ao salvar");
          setSaving(false);
          return;
        }
      }

      setFormMode("closed");
      setEditId(null);
      setForm({ name: "", email: "", password: "", role: "ANALYST", tenantId: "" });
      fetchData();
    } catch {
      setError("Erro de conexão");
    }
    setSaving(false);
  }

  async function handleToggle(userId: string, isActive: boolean) {
    await fetch(`/api/admin/users?id=${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !isActive }),
    });
    fetchData();
  }

  function openCreate() {
    setForm({ name: "", email: "", password: "", role: "ANALYST", tenantId: tenants[0]?.id || "" });
    setEditId(null);
    setFormMode("create");
    setError("");
  }

  function openEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      tenantId: user.tenant_id || "",
    });
    setEditId(user.id);
    setFormMode("edit");
    setError("");
  }

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.tenant_nome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Gerenciar Usuários
          </h1>
          <p className="mt-1 text-sm text-slate-500">{users.length} usuários em {tenants.length} tenants</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo Usuário
        </Button>
      </div>

      {/* Create / Edit Form */}
      {formMode !== "closed" && (
        <div className="rounded-xl border border-indigo-800/40 bg-gradient-to-br from-indigo-950/20 to-slate-900/50 p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            {formMode === "create" ? (
              <><Plus className="h-4 w-4 text-indigo-400" /> Criar Novo Usuário</>
            ) : (
              <><Edit2 className="h-4 w-4 text-amber-400" /> Editar Usuário</>
            )}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome Completo *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="João Silva"
                className="border-slate-700/50 bg-slate-800/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="joao@empresa.com"
                disabled={formMode === "edit"}
                className="border-slate-700/50 bg-slate-800/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Senha {formMode === "edit" ? "(deixe vazio para manter)" : "*"}
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={formMode === "edit" ? "••••••••" : "Mínimo 6 caracteres"}
                className="border-slate-700/50 bg-slate-800/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Perfil *</label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="border-slate-700/50 bg-slate-800/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  <SelectItem value="VIEWER">Visualizador</SelectItem>
                  <SelectItem value="ANALYST">Analista</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Empresa / Tenant *</label>
              <Select value={form.tenantId} onValueChange={(v) => setForm((f) => ({ ...f, tenantId: v }))}>
                <SelectTrigger className="border-slate-700/50 bg-slate-800/50">
                  <SelectValue placeholder="Selecione um tenant" />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-800">
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-indigo-400" />
                        {t.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {formMode === "create" ? "Criar Usuário" : "Salvar Alterações"}
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
          placeholder="Buscar por nome, email ou tenant..."
          className="pl-10 border-slate-700/50 bg-slate-800/50"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/50 p-10 text-center">
          <Users className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const roleConf = ROLE_CONFIG[u.role] || ROLE_CONFIG.VIEWER;
            const RoleIcon = roleConf.icon;
            return (
              <div
                key={u.id}
                className={`rounded-xl border p-4 transition-all ${
                  u.is_active
                    ? "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/60"
                    : "border-slate-800/30 bg-slate-900/20 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      u.is_active ? "bg-indigo-500/15" : "bg-slate-800/50"
                    }`}>
                      <span className="text-sm font-bold text-indigo-300">
                        {(u.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-sm">{u.name}</p>
                        <Badge className={`${roleConf.color} text-[10px] gap-1`}>
                          <RoleIcon className="h-2.5 w-2.5" />
                          {roleConf.label}
                        </Badge>
                        {!u.is_active && (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {u.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {u.tenant_nome}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs text-slate-600">
                      <p>Último login</p>
                      <p className="text-slate-400">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "Nunca"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        title="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-900/20 hover:text-indigo-400 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggle(u.id, u.is_active)}
                        title={u.is_active ? "Desativar" : "Ativar"}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-amber-900/20 hover:text-amber-400 transition-colors"
                      >
                        {u.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

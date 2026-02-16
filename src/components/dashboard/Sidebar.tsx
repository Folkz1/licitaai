"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Kanban,
  Settings,
  Users,
  Building2,
  DollarSign,
  Sparkles,
  ChevronRight,
  Key,
} from "lucide-react";

interface SidebarProps {
  user: {
    role: string;
    tenantName: string;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Visao geral" },
  { href: "/licitacoes", label: "Licitacoes", icon: FileText, description: "Todas as licitacoes" },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, description: "Kanban de revisao" },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings, description: "Busca e filtros" },
  { href: "/api-keys", label: "API Keys", icon: Key, description: "Chaves e creditos" },
];

const adminItems = [
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/custos", label: "Custos LLM", icon: DollarSign },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  return (
    <aside className="flex w-64 flex-col border-r border-slate-800/60 bg-gradient-to-b from-slate-900/95 to-slate-950/95">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800/60 px-6">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
          <Sparkles className="h-4 w-4 text-white" />
          <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
        </div>
        <div>
          <p className="text-sm font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">LicitaIA</p>
          <p className="text-[10px] text-slate-500 tracking-wider uppercase">{user.tenantName}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Menu Principal
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-indigo-600/15 text-indigo-300 shadow-sm"
                  : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
              )}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-indigo-500" />
              )}
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                active ? "bg-indigo-500/20" : "bg-slate-800/50 group-hover:bg-slate-700/50"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{item.label}</p>
                {active && item.description && (
                  <p className="text-[10px] text-indigo-400/60 truncate">{item.description}</p>
                )}
              </div>
              {active && <ChevronRight className="h-3.5 w-3.5 text-indigo-400/40" />}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-4 border-t border-slate-800/40" />
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-amber-600/60">
              Administracao
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-amber-600/10 text-amber-300"
                      : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
                  )}
                >
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-amber-500/15" : "bg-slate-800/40 group-hover:bg-slate-700/50"
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800/40 p-4">
        <div className="flex items-center gap-2 rounded-lg bg-slate-800/30 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[10px] text-slate-600">LicitaIA v1.0 • Online</p>
        </div>
      </div>
    </aside>
  );
}

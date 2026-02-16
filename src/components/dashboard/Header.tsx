"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Building2, ChevronDown, Check } from "lucide-react";

interface Tenant {
  id: string;
  nome: string;
}

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
    tenantId: string;
    tenantName: string;
  };
}

export function Header({ user }: HeaderProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState(user.tenantId);
  const [activeTenantName, setActiveTenantName] = useState(user.tenantName);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/admin/tenants")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTenants(data);
            // Check cookie for current override
            const cookieOverride = document.cookie
              .split("; ")
              .find((c) => c.startsWith("x-tenant-override="))
              ?.split("=")[1];
            if (cookieOverride) {
              setActiveTenantId(cookieOverride);
              const found = data.find((t: Tenant) => t.id === cookieOverride);
              if (found) setActiveTenantName(found.nome);
            }
          }
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  function handleTenantSwitch(tenant: Tenant) {
    setActiveTenantId(tenant.id);
    setActiveTenantName(tenant.nome);
    setTenantMenuOpen(false);
    // Store in cookie so API routes can read it
    document.cookie = `x-tenant-override=${tenant.id};path=/;max-age=${60 * 60 * 24}`;
    // Reload to apply new tenant context
    window.location.reload();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800/60 bg-slate-950/50 px-6">
      <div className="flex items-center gap-3">
        {/* Super Admin: Tenant Switcher */}
        {isSuperAdmin && tenants.length > 0 && (
          <DropdownMenu open={tenantMenuOpen} onOpenChange={setTenantMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-1.5 text-sm transition-all hover:border-amber-700/50 hover:bg-amber-900/30">
                <Building2 className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-medium text-amber-300 max-w-[200px] truncate">
                  {activeTenantName || "Selecione um tenant"}
                </span>
                <ChevronDown className="h-3 w-3 text-amber-500/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[260px] border-slate-700 bg-slate-800 p-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Trocar Tenant
              </div>
              {tenants.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => handleTenantSwitch(t)}
                  className={`flex items-center justify-between gap-2 cursor-pointer rounded-md px-2 py-2 ${
                    t.id === activeTenantId
                      ? "bg-indigo-600/15 text-indigo-300"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-sm truncate">{t.nome}</span>
                  </span>
                  {t.id === activeTenantId && (
                    <Check className="h-3.5 w-3.5 text-indigo-400" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-slate-300 hover:text-white h-9 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-indigo-600 text-[10px] text-white font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-medium block leading-none">{user.name}</span>
                <span className="text-[10px] text-slate-500 block leading-none mt-0.5">{user.email}</span>
              </div>
              {isSuperAdmin && (
                <span className="rounded bg-amber-600/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 tracking-wider">
                  SUPER
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px] border-slate-700 bg-slate-800">
            <DropdownMenuItem className="text-slate-400 text-xs" disabled>
              <User className="mr-2 h-3.5 w-3.5" />
              {user.role}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-300 cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

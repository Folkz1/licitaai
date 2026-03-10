"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  urgent: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
};

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClick(notif: Notification) {
    if (!notif.read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notif.id }),
      });
      setUnread((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    if (notif.link) {
      setOpen(false);
      router.push(notif.link);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] max-h-[480px] overflow-y-auto border-slate-700 bg-slate-800 p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <span className="text-sm font-semibold text-white">Notificações</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Check className="h-3 w-3" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Bell className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <div>
            {notifications.map((notif) => {
              const config = typeConfig[notif.type] || typeConfig.info;
              const Icon = config.icon;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-700/50 ${
                    !notif.read ? "bg-slate-750/30" : ""
                  }`}
                >
                  <div className={`mt-0.5 rounded-lg p-1.5 ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${!notif.read ? "text-white" : "text-slate-300"}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-slate-700 m-0" />
            <div className="px-4 py-2.5 text-center">
              <span className="text-xs text-slate-500">
                {unread > 0 ? `${unread} não lida(s)` : "Todas lidas"}
              </span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

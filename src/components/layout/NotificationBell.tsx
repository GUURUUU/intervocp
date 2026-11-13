"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEventStream } from "@/hooks/use-event-stream";
import { formatDateTime } from "@/lib/format";

interface NotificationItem {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

/**
 * Live notification bell: polls the REST endpoint once, then receives
 * updates through the SSE stream.
 */
export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: NotificationItem[];
        unreadCount: number;
      };
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      // offline — ignore
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Live updates through SSE
  useEventStream(
    useCallback(
      (event) => {
        if (event.type === "notification") {
          void refresh();
        }
      },
      [refresh]
    )
  );

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white/80 hover:text-white"
          aria-label={`Notifications (${unread} non lues)`}
        >
          {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-white/10 bg-[#151b1d]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold text-white">Notifications</span>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-emerald-300 hover:text-emerald-200"
              onClick={markAllRead}
            >
              Tout marquer lu
            </Button>
          ) : null}
        </div>
        <ScrollArea className="h-72">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-white/50">
              Aucune notification
            </p>
          ) : (
            <ul className="space-y-1 px-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    item.read ? "text-white/50" : "bg-emerald-500/10 text-white"
                  }`}
                >
                  <p>{item.message}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {formatDateTime(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

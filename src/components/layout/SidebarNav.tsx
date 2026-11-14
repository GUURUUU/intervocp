"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/format";
import { NAV_ITEMS } from "./nav-items";

interface SidebarNavProps {
  role: Role;
  userName: string;
}

/** Glass sidebar navigation, filtered by role. */
export default function SidebarNav({ role, userName }: SidebarNavProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="glass-panel fixed inset-y-0 left-0 z-50 hidden w-64 flex-col rounded-none border-y-0 border-l-0 lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <Wrench className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <span className="text-base font-bold text-foreground">IntervOCP</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation principale">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="glass-panel-soft rounded-lg px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">{userName}</p>
          <p className="text-xs text-emerald-700">{ROLE_LABELS[role]}</p>
        </div>
      </div>
    </aside>
  );
}

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

/**
 * OCP console sidebar: navy panel, gold active marker, role filtering.
 * Hidden below `lg`; the mobile drawer lives in AppShell.
 */
export default function SidebarNav({ role, userName }: SidebarNavProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const initials = userName
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col bg-[#0b2a4a] lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c7a44a] text-[#0b2a4a]">
          <Wrench className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-white">
            IntervOCP
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-[#c7a44a]">
            OCP Khouribga
          </span>
        </span>
      </div>

      <nav
        className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
        aria-label="Navigation principale"
      >
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Exploitation
        </p>
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-[#c7a44a] bg-white/10 font-semibold text-white"
                  : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-md bg-white/5 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c7a44a] text-[11px] font-bold text-[#0b2a4a]">
            {initials || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">{userName}</p>
            <p className="truncate text-[11px] text-[#c7a44a]">
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

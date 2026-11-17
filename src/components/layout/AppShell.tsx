"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Wrench, X } from "lucide-react";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import SidebarNav from "./SidebarNav";
import NotificationBell from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/format";
import { NAV_ITEMS, pageTitle } from "./nav-items";

interface AppShellProps {
  user: { id: string; name: string; email: string; role: Role };
  children: React.ReactNode;
}

/**
 * Operations console shell: navy sidebar on desktop, white command bar,
 * navy mobile drawer. The login page keeps its own visual world.
 */
export default function AppShell({ user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const signOutAndHome = async () => {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  };

  const initials = user.name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <SidebarNav role={user.role} userName={user.name} />

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[#061a2e]/70"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#0b2a4a]">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c7a44a] text-[#0b2a4a]">
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-white">IntervOCP</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Navigation mobile">
              {NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map(
                (item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
                        active
                          ? "border-[#c7a44a] bg-white/10 font-semibold text-white"
                          : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                }
              )}
            </nav>

            <div className="border-t border-white/10 p-3">
              <div className="rounded-md bg-white/5 px-3 py-2">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-[#c7a44a]">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground/80 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Service IT · DSI/O/P/K
              </p>
              <p className="text-sm font-semibold text-foreground sm:text-base">
                {pageTitle(pathname)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <div className="hidden items-center gap-2.5 border-l border-border pl-3 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b2a4a] text-[11px] font-bold text-white">
                {initials || "?"}
              </span>
              <span className="leading-tight">
                <span className="block text-xs font-medium text-foreground">
                  {user.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOutAndHome}
              aria-label="Se déconnecter"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

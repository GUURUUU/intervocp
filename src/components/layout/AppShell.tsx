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
 * Dashboard shell: glass sidebar (desktop), gradient top bar with the
 * live notification bell and sign-out. Fully responsive (mobile drawer).
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SidebarNav role={user.role} userName={user.name} />

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="glass-panel absolute inset-y-0 left-0 flex w-64 flex-col rounded-none border-y-0 border-l-0">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <span className="text-base font-bold text-foreground">IntervOCP</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation mobile">
              {NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map(
                (item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                        active
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "text-muted-foreground hover:bg-foreground/5"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                }
              )}
            </nav>

            <div className="border-t border-border p-3">
              <div className="glass-panel-soft rounded-lg px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-emerald-700">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="brand-gradient sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border px-4 backdrop-blur-xl sm:px-6">
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
            <h2 className="text-sm font-medium text-foreground/80 sm:text-base">
              {pageTitle(pathname)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="glass-panel-soft hidden rounded-lg px-3 py-1.5 text-right sm:block">
              <p className="text-xs font-medium text-foreground">{user.name}</p>
              <p className="text-[10px] text-emerald-700">{ROLE_LABELS[user.role]}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOutAndHome}
              aria-label="Se déconnecter"
              className="text-foreground/80 hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

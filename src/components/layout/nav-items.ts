import {
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
} from "lucide-react";
import type { Role } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

/** Main navigation, filtered by role at render time. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    roles: ["ADMIN", "DISPATCHER", "TECHNICIAN", "CLIENT", "MANAGER"],
  },
  {
    href: "/requests",
    label: "Demandes",
    icon: ClipboardList,
    roles: ["ADMIN", "DISPATCHER", "TECHNICIAN", "CLIENT", "MANAGER"],
  },
  {
    href: "/planning",
    label: "Planification",
    icon: CalendarDays,
    roles: ["ADMIN", "DISPATCHER", "TECHNICIAN"],
  },
  {
    href: "/tracking",
    label: "Suivi des interventions",
    icon: ListChecks,
    roles: ["ADMIN", "DISPATCHER", "TECHNICIAN", "MANAGER"],
  },
  {
    href: "/stock",
    label: "Stock",
    icon: Package,
    roles: ["ADMIN", "DISPATCHER", "TECHNICIAN", "MANAGER"],
  },
  {
    href: "/reports",
    label: "Rapports",
    icon: FileText,
    roles: ["ADMIN", "DISPATCHER", "TECHNICIAN", "CLIENT", "MANAGER"],
  },
  {
    href: "/admin",
    label: "Administration",
    icon: Settings,
    roles: ["ADMIN"],
  },
];

export function pageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Tableau de bord";
  if (pathname.startsWith("/requests")) return "Demandes d'intervention";
  if (pathname.startsWith("/planning")) return "Planification & affectation";
  if (pathname.startsWith("/tracking")) return "Suivi des interventions";
  if (pathname.startsWith("/stock")) return "Gestion des stocks";
  if (pathname.startsWith("/reports")) return "Rapports";
  if (pathname.startsWith("/admin")) return "Administration";
  return "IntervOCP";
}

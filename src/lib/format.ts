import { Status, InterventionType, Priority, Role, AvailabilityType } from "@prisma/client";

/** French labels for statuses. */
export const STATUS_LABELS: Record<Status, string> = {
  NOUVELLE: "Nouvelle",
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  EN_ATTENTE_PIECES: "En attente pièces",
  TERMINEE: "Terminée",
  CLOTUREE: "Clôturée",
  ANNULEE: "Annulée",
};

/** Tailwind badge classes per status (light theme). */
export const STATUS_BADGE_CLASS: Record<Status, string> = {
  NOUVELLE: "bg-sky-100 text-sky-800 border-sky-200",
  PLANIFIEE: "bg-amber-100 text-amber-800 border-amber-200",
  EN_COURS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EN_ATTENTE_PIECES: "bg-orange-100 text-orange-800 border-orange-200",
  TERMINEE: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CLOTUREE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ANNULEE: "bg-rose-100 text-rose-800 border-rose-200",
};

export const TYPE_LABELS: Record<InterventionType, string> = {
  CORRECTIVE: "Corrective",
  PREVENTIVE: "Préventive",
  URGENT: "Urgente",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
  CRITICAL: "Critique",
};

export const PRIORITY_BADGE_CLASS: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  DISPATCHER: "Répartiteur",
  TECHNICIAN: "Technicien",
  CLIENT: "Client",
  MANAGER: "Responsable",
};

export const AVAILABILITY_LABELS: Record<AvailabilityType, string> = {
  WORK: "Travail",
  LEAVE: "Congé",
  BUSY: "Occupé",
};

/** Formats an amount in MAD (Moroccan dirham). */
export function formatMad(value: number): string {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Formats a date as "13 nov. 2026". */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
    new Date(date)
  );
}

/** Formats a time as "14:30". */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Formats a date+time as "13 nov. 2026 à 14:30". */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

/** Human readable duration between two dates ("2 h 30 min"). */
export function formatDuration(start: Date | string, end: Date | string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const minutes = Math.round(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  return `${hours} h ${String(mins).padStart(2, "0")}`;
}

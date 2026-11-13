import { Status } from "@prisma/client";

/**
 * Allowed status transitions (enforced server-side).
 * Every transition is logged into `StatusHistory`.
 */
export const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  NOUVELLE: ["PLANIFIEE", "ANNULEE"],
  PLANIFIEE: ["EN_COURS", "ANNULEE"],
  EN_COURS: ["TERMINEE", "EN_ATTENTE_PIECES", "ANNULEE"],
  EN_ATTENTE_PIECES: ["EN_COURS", "ANNULEE"],
  TERMINEE: ["CLOTUREE"],
  CLOTUREE: [],
  ANNULEE: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** French label for a transition failure error message. */
export const STATUS_ORDER: Status[] = [
  "NOUVELLE",
  "PLANIFIEE",
  "EN_COURS",
  "EN_ATTENTE_PIECES",
  "TERMINEE",
  "CLOTUREE",
];

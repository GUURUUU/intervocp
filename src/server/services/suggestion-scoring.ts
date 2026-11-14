/**
 * Pure scoring components for the technician suggestion algorithm.
 * No I/O — fully unit-testable (see tests/suggestion-scoring.test.ts).
 */

import type { Status } from "@prisma/client";

export const WEIGHTS = {
  skill: 0.4,
  availability: 0.25,
  workload: 0.2,
  distance: 0.15,
} as const;

/** Active statuses count as occupied for workload / double-booking. */
export const ACTIVE_STATUSES: Status[] = [
  "PLANIFIEE",
  "EN_COURS",
  "EN_ATTENTE_PIECES",
];

export interface SuggestionBreakdown {
  skillMatch: number;
  availability: number;
  workload: number;
  distance: number;
}

export interface AvailabilityWindow {
  start: Date;
  end: Date;
  type: "WORK" | "LEAVE" | "BUSY";
}

/** Overlap test for two date ranges (inclusive of touching bounds). */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Normalizes a skill level 1..5 into 0..1 (level 1 → 0.2, level 5 → 1.0). */
export function skillScore(level: number | null): number {
  if (!level) return 0;
  return level / 5;
}

/**
 * Availability component:
 *   1.0 — a WORK block fully covers the slot and no LEAVE/BUSY overlaps it
 *   0.0 — a LEAVE/BUSY block overlaps the slot
 *   0.5 — no availability data for that day (unknown)
 */
export function availabilityScore(
  slotStart: Date,
  slotEnd: Date,
  windows: AvailabilityWindow[]
): { score: number; blocked: boolean } {
  const covering = windows.filter(
    (w) =>
      w.type === "WORK" &&
      w.start <= slotStart &&
      w.end >= slotEnd
  );
  const blocking = windows.filter(
    (w) => w.type !== "WORK" && overlaps(slotStart, slotEnd, w.start, w.end)
  );

  if (blocking.length > 0) return { score: 0, blocked: true };
  if (covering.length > 0) return { score: 1, blocked: false };

  const anyThatDay = windows.length > 0;
  return { score: anyThatDay ? 0 : 0.5, blocked: false };
}

/**
 * Workload component (inverse): fewer concurrent/active jobs → closer to 1.
 * `activeOverlaps` counts active interventions whose planned window overlaps
 * the slot (double-booking risk), `weekLoad` counts all active jobs in the
 * slot's calendar week.
 */
export function workloadScore(activeOverlaps: number, weekLoad: number): number {
  const raw = 1 - Math.min(1, activeOverlaps * 0.5 + weekLoad * 0.1);
  return Math.max(0, raw);
}

/**
 * Distance component: 2 km or less → 1.0; 20 km or more → 0.0;
 * linear in between. Unknown distance (no ping / no coords) → 0.5.
 */
export function distanceScore(distanceKm: number | null): number {
  if (distanceKm === null) return 0.5;
  if (distanceKm <= 2) return 1;
  if (distanceKm >= 20) return 0;
  return 1 - (distanceKm - 2) / 18;
}

/** Weighted total score, rounded to 2 decimals. */
export function totalScore(breakdown: SuggestionBreakdown): number {
  const raw =
    WEIGHTS.skill * breakdown.skillMatch +
    WEIGHTS.availability * breakdown.availability +
    WEIGHTS.workload * breakdown.workload +
    WEIGHTS.distance * breakdown.distance;
  return Math.round(raw * 100) / 100;
}

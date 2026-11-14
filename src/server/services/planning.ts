import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";
import { publish } from "@/lib/events";
import { notifyUsers } from "@/lib/notifications";
import { ApiError } from "@/lib/api-helpers";
import type { Prisma, Status } from "@prisma/client";
import type { User } from "@prisma/client";

// ---------------------------------------------------------------------------
// Technician suggestion algorithm
//
// Ranks technicians for a planned slot using four weighted components:
//   (a) skill match        — required skill mastery level (weight 0.40)
//   (b) availability       — WORK covers the slot, no LEAVE/BUSY (weight 0.25)
//   (c) current workload   — fewer active jobs = higher score (weight 0.20)
//   (d) distance           — proximity of the latest location ping (weight 0.15)
//
// The full breakdown is returned so the Dispatcher can see WHY each
// technician was ranked where they are.
// ---------------------------------------------------------------------------

const WEIGHTS = {
  skill: 0.4,
  availability: 0.25,
  workload: 0.2,
  distance: 0.15,
} as const;

/** Active statuses count as occupied for workload / double-booking. */
const ACTIVE_STATUSES: Status[] = ["PLANIFIEE", "EN_COURS", "EN_ATTENTE_PIECES"];

export interface SuggestionBreakdown {
  skillMatch: number;
  availability: number;
  workload: number;
  distance: number;
}

export interface Suggestion {
  technicianId: string;
  name: string;
  email: string;
  totalScore: number;
  /** True when the technician cannot take the slot (double-booking, leave). */
  ineligible: boolean;
  reasons: string[];
  breakdown: SuggestionBreakdown;
  /** Distance in km to the intervention location (null if unknown). */
  distanceKm: number | null;
  skillLevel: number | null;
  activeJobs: number;
}

interface AvailabilityWindow {
  start: Date;
  end: Date;
  type: "WORK" | "LEAVE" | "BUSY";
}

/** Overlap test for two date ranges (inclusive of touching bounds). */
function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Normalizes a skill level 1..5 into 0..1 (level 1 → 0.2, level 5 → 1.0). */
function skillScore(level: number | null): number {
  if (!level) return 0;
  return level / 5;
}

/**
 * Availability component:
 *   1.0 — a WORK block fully covers the slot and no LEAVE/BUSY overlaps it
 *   0.0 — a LEAVE/BUSY block overlaps the slot
 *   0.5 — no availability data for that day (unknown)
 */
function availabilityScore(
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
function workloadScore(activeOverlaps: number, weekLoad: number): number {
  const raw = 1 - Math.min(1, activeOverlaps * 0.5 + weekLoad * 0.1);
  return Math.max(0, raw);
}

/**
 * Distance component: 2 km or less → 1.0; 20 km or more → 0.0;
 * linear in between. Unknown distance (no ping / no coords) → 0.5.
 */
function distanceScore(distanceKm: number | null): number {
  if (distanceKm === null) return 0.5;
  if (distanceKm <= 2) return 1;
  if (distanceKm >= 20) return 0;
  return 1 - (distanceKm - 2) / 18;
}

/** Rank all active technicians for the given intervention + slot. */
export async function suggestTechnicians(
  interventionId: string,
  plannedStart: Date,
  plannedEnd: Date
): Promise<Suggestion[]> {
  const intervention = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: {
      id: true,
      requiredSkillId: true,
      latitude: true,
      longitude: true,
      plannedStart: true,
      plannedEnd: true,
    },
  });
  if (!intervention) throw new ApiError(404, "Intervention introuvable");

  // Week boundaries of the slot (Monday 00:00 → Sunday 23:59)
  const weekStart = new Date(plannedStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const technicians = await prisma.user.findMany({
    where: { role: "TECHNICIAN", active: true },
    select: { id: true, name: true, email: true },
  });

  const suggestions: Suggestion[] = [];

  for (const tech of technicians) {
    const reasons: string[] = [];
    let ineligible = false;

    // (a) Skill match
    const skillLevel = intervention.requiredSkillId
      ? (
          await prisma.technicianSkill.findUnique({
            where: {
              technicianId_skillId: {
                technicianId: tech.id,
                skillId: intervention.requiredSkillId,
              },
            },
          })
        )?.level ?? null
      : null;

    const skillMatch = intervention.requiredSkillId
      ? skillScore(skillLevel)
      : 0.6; // neutral when no skill is required
    if (skillLevel) {
      reasons.push(`Compétence niveau ${skillLevel}/5`);
    } else if (intervention.requiredSkillId) {
      reasons.push("Compétence requise non maîtrisée");
    }

    // (b) Availability
    const dayStart = new Date(plannedStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const availability = await prisma.availability.findMany({
      where: {
        technicianId: tech.id,
        start: { lte: dayEnd },
        end: { gte: dayStart },
      },
      select: { start: true, end: true, type: true },
    });

    const avail = availabilityScore(plannedStart, plannedEnd, availability);
    const availabilityMatch = avail.score;
    if (avail.blocked) {
      ineligible = true;
      reasons.push("Indisponible sur ce créneau (congé/occupé)");
    }

    // (c) Workload (also detects double-booking)
    const activeJobs = await prisma.assignment.findMany({
      where: {
        technicianId: tech.id,
        intervention: { status: { in: ACTIVE_STATUSES } },
      },
      include: {
        intervention: {
          select: { plannedStart: true, plannedEnd: true, reference: true },
        },
      },
    });

    const activeOverlaps = activeJobs.filter((job) => {
      const s = job.intervention.plannedStart;
      const e = job.intervention.plannedEnd;
      if (!s || !e) return false;
      return overlaps(plannedStart, plannedEnd, s, e);
    });

    const weekLoad = activeJobs.filter((job) => {
      const s = job.intervention.plannedStart;
      return s && s >= weekStart && s < weekEnd;
    }).length;

    const workloadMatch = workloadScore(activeOverlaps.length, weekLoad);
    if (activeOverlaps.length > 0) {
      ineligible = true;
      reasons.push(
        `Déjà affecté sur ${activeOverlaps.map((j) => j.intervention.reference).join(", ")} sur ce créneau`
      );
    } else if (weekLoad > 0) {
      reasons.push(`${weekLoad} intervention(s) active(s) cette semaine`);
    }

    // (d) Distance to the intervention (latest ping)
    let distanceKm: number | null = null;
    if (intervention.latitude != null && intervention.longitude != null) {
      const lastPing = await prisma.locationPing.findFirst({
        where: { technicianId: tech.id },
        orderBy: { timestamp: "desc" },
      });
      if (lastPing) {
        distanceKm = haversineKm(
          { latitude: lastPing.latitude, longitude: lastPing.longitude },
          { latitude: intervention.latitude, longitude: intervention.longitude }
        );
        reasons.push(`À ${distanceKm.toFixed(1)} km du site`);
      }
    }

    const distanceMatch = distanceScore(distanceKm);

    const breakdown: SuggestionBreakdown = {
      skillMatch,
      availability: availabilityMatch,
      workload: workloadMatch,
      distance: distanceMatch,
    };

    const totalScore =
      WEIGHTS.skill * skillMatch +
      WEIGHTS.availability * availabilityMatch +
      WEIGHTS.workload * workloadMatch +
      WEIGHTS.distance * distanceMatch;

    suggestions.push({
      technicianId: tech.id,
      name: tech.name,
      email: tech.email,
      totalScore: Math.round(totalScore * 100) / 100,
      ineligible,
      reasons,
      breakdown,
      distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
      skillLevel,
      activeJobs: activeJobs.length,
    });
  }

  // Eligible first, then by score
  suggestions.sort((a, b) => {
    if (a.ineligible !== b.ineligible) return a.ineligible ? 1 : -1;
    return b.totalScore - a.totalScore;
  });

  return suggestions;
}

// ---------------------------------------------------------------------------
// Manual assignment with double-booking prevention
// ---------------------------------------------------------------------------

export async function assignTechnician(
  user: Pick<User, "id" | "role">,
  input: {
    interventionId: string;
    technicianId: string;
    plannedStart?: Date;
    plannedEnd?: Date;
  }
) {
  // Only office roles can assign
  if (user.role !== "ADMIN" && user.role !== "DISPATCHER") {
    throw new ApiError(403, "Seul le bureau peut affecter des techniciens");
  }

  const intervention = await prisma.intervention.findUnique({
    where: { id: input.interventionId },
  });
  if (!intervention) throw new ApiError(404, "Intervention introuvable");
  if (["CLOTUREE", "ANNULEE"].includes(intervention.status)) {
    throw new ApiError(409, "Intervention déjà clôturée ou annulée");
  }

  const technician = await prisma.user.findFirst({
    where: { id: input.technicianId, role: "TECHNICIAN", active: true },
  });
  if (!technician) throw new ApiError(404, "Technicien introuvable ou inactif");

  const plannedStart = input.plannedStart ?? intervention.plannedStart;
  const plannedEnd = input.plannedEnd ?? intervention.plannedEnd;
  if (!plannedStart || !plannedEnd) {
    throw new ApiError(
      400,
      "Créneau planifié requis (dates existantes ou fournies)"
    );
  }

  // Double-booking prevention (inside a transaction, re-checked)
  const result = await prisma.$transaction(async (tx) => {
    const conflicting = await tx.assignment.findMany({
      where: {
        technicianId: input.technicianId,
        intervention: {
          status: { in: ["PLANIFIEE", "EN_COURS", "EN_ATTENTE_PIECES"] },
          plannedStart: { not: null },
          plannedEnd: { not: null },
        },
      },
      include: {
        intervention: { select: { plannedStart: true, plannedEnd: true, reference: true } },
      },
    });

    const clash = conflicting.find((c) => {
      const s = c.intervention.plannedStart as Date;
      const e = c.intervention.plannedEnd as Date;
      return s < plannedEnd && plannedStart < e;
    });

    if (clash) {
      throw new ApiError(
        409,
        `Double réservation : ${technician.name} est déjà affecté à ${clash.intervention.reference} sur ce créneau`
      );
    }

    // Leave/busy check
    const blocking = await tx.availability.findFirst({
      where: {
        technicianId: input.technicianId,
        type: { in: ["LEAVE", "BUSY"] },
        start: { lt: plannedEnd },
        end: { gt: plannedStart },
      },
    });
    if (blocking) {
      throw new ApiError(
        409,
        `${technician.name} est indisponible (congé/occupé) sur ce créneau`
      );
    }

    await tx.assignment.create({
      data: {
        interventionId: input.interventionId,
        technicianId: input.technicianId,
        assignedBy: user.id,
      },
    });

    const updateData: Prisma.InterventionUpdateInput = {
      plannedStart,
      plannedEnd,
    };

    // First assignment moves NOUVELLE → PLANIFIEE (logged below)
    const nextStatus: Status =
      intervention.status === "NOUVELLE" ? "PLANIFIEE" : intervention.status;

    const updated = await tx.intervention.update({
      where: { id: input.interventionId },
      data: { ...updateData, status: nextStatus },
    });

    if (nextStatus !== intervention.status) {
      await tx.statusHistory.create({
        data: {
          interventionId: input.interventionId,
          fromStatus: intervention.status,
          toStatus: nextStatus,
          changedBy: user.id,
          comment: `Affecté à ${technician.name}`,
        },
      });
    }

    return updated;
  });

  await notifyUsers({
    userIds: [input.technicianId],
    message: `Vous êtes affecté à ${intervention.reference} — « ${intervention.title} »`,
  });

  publish("intervention.assigned", {
    id: intervention.id,
    reference: intervention.reference,
    technicianId: input.technicianId,
  });

  return result;
}

/** Calendar data: assignments in range with intervention info. */
export async function getCalendar(start: Date, end: Date) {
  const assignments = await prisma.assignment.findMany({
    where: {
      intervention: {
        plannedStart: { not: null, gte: start, lte: end },
        status: { in: ["PLANIFIEE", "EN_COURS", "EN_ATTENTE_PIECES", "TERMINEE"] },
      },
    },
    include: {
      technician: { select: { id: true, name: true } },
      intervention: {
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          priority: true,
          type: true,
          plannedStart: true,
          plannedEnd: true,
          locationText: true,
          equipment: { select: { name: true } },
        },
      },
    },
    orderBy: { intervention: { plannedStart: "asc" } },
  });

  // Also include NOUVELLE requests without slot for the assignment queue
  const unscheduled = await prisma.intervention.findMany({
    where: {
      status: "NOUVELLE",
      plannedStart: null,
    },
    select: {
      id: true,
      reference: true,
      title: true,
      priority: true,
      type: true,
      createdAt: true,
      requiredSkill: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const technicians = await prisma.user.findMany({
    where: { role: "TECHNICIAN", active: true },
    select: { id: true, name: true },
  });

  return { assignments, unscheduled, technicians };
}

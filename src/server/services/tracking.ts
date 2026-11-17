import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/events";
import { ApiError } from "@/lib/api-helpers";

/** Minimal session identity used by the tracking service. */
export interface TrackingUser {
  id: string;
  role: Role;
}

/** Demo base coordinates: OCP industrial site, Khouribga. */
export const SITE_CENTER = { latitude: 32.8866, longitude: -6.9063 };

/** Pings older than this are considered stale and not shown live. */
const PING_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const OFFICE_ROLES: TrackingUser["role"][] = ["ADMIN", "DISPATCHER", "MANAGER"];

export interface LivePosition {
  technicianId: string;
  name: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  simulated?: boolean;
}

function isOffice(user: TrackingUser): boolean {
  return OFFICE_ROLES.includes(user.role);
}

/**
 * Records a technician position ping. Any authenticated user can record
 * their own position; office roles get an instant SSE notification.
 */
export async function recordPing(
  user: TrackingUser,
  latitude: number,
  longitude: number
): Promise<void> {
  if (user.role !== "TECHNICIAN" && !isOffice(user)) {
    throw new ApiError(403, "Seuls les techniciens peuvent partager leur position");
  }
  await prisma.locationPing.create({
    data: { technicianId: user.id, latitude, longitude },
  });
  publish(
    "location.ping",
    { technicianId: user.id, latitude, longitude },
    { targetRoles: ["ADMIN", "DISPATCHER", "MANAGER"] }
  );
}

/**
 * Latest known position per technician (office roles) or own latest pings
 * (technician). Positions older than PING_MAX_AGE_MS are excluded.
 */
export async function getLivePositions(user: TrackingUser): Promise<{
  positions: LivePosition[];
}> {
  const since = new Date(Date.now() - PING_MAX_AGE_MS);

  if (user.role === "TECHNICIAN") {
    const pings = await prisma.locationPing.findMany({
      where: { technicianId: user.id, timestamp: { gte: since } },
      orderBy: { timestamp: "desc" },
      take: 20,
      include: { technician: { select: { id: true, name: true } } },
    });
    return {
      positions: pings.map((p) => ({
        technicianId: p.technicianId,
        name: p.technician.name,
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.timestamp.toISOString(),
      })),
    };
  }

  if (!isOffice(user)) {
    throw new ApiError(403, "Accès réservé aux rôles internes");
  }

  // Latest ping per technician (PostgreSQL DISTINCT ON).
  const rows = await prisma.$queryRaw<
    {
      technicianId: string;
      name: string;
      latitude: number;
      longitude: number;
      timestamp: Date;
    }[]
  >`
    SELECT DISTINCT ON (lp."technicianId")
           lp."technicianId" AS "technicianId",
           u.name            AS name,
           lp.latitude       AS latitude,
           lp.longitude      AS longitude,
           lp.timestamp      AS timestamp
    FROM "LocationPing" lp
    JOIN "User" u ON u.id = lp."technicianId"
    WHERE u.role = 'TECHNICIAN' AND lp.timestamp >= ${since}
    ORDER BY lp."technicianId", lp.timestamp DESC
  `;

  return {
    positions: rows.map((r) => ({
      technicianId: r.technicianId,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      timestamp: r.timestamp.toISOString(),
    })),
  };
}

/**
 * Demo simulator: jitters every technician around their last known
 * position (or around the site base) and records the new pings. Used by
 * the tracking page so the live map has moving markers without real GPS.
 */
export async function simulatePings(user: TrackingUser): Promise<{ count: number }> {
  if (!isOffice(user)) {
    throw new ApiError(403, "Simulation réservée aux rôles internes");
  }

  const technicians = await prisma.user.findMany({
    where: { role: "TECHNICIAN" },
    select: { id: true, name: true },
  });

  const since = new Date(Date.now() - PING_MAX_AGE_MS);
  const latest = await prisma.$queryRaw<
    { technicianId: string; latitude: number; longitude: number }[]
  >`
    SELECT DISTINCT ON (lp."technicianId")
           lp."technicianId" AS "technicianId",
           lp.latitude       AS latitude,
           lp.longitude      AS longitude
    FROM "LocationPing" lp
    WHERE lp.timestamp >= ${since}
    ORDER BY lp."technicianId", lp.timestamp DESC
  `;
  const lastByTech = new Map(latest.map((r) => [r.technicianId, r]));

  // ~0.004° ≈ 400 m. Deterministic walk: smaller step than the spread.
  const JITTER = 0.002;
  const records: {
    technicianId: string;
    latitude: number;
    longitude: number;
    name: string;
  }[] = [];

  for (const tech of technicians) {
    const base = lastByTech.get(tech.id);
    const lat = base
      ? base.latitude + (Math.random() - 0.5) * JITTER
      : SITE_CENTER.latitude + (Math.random() - 0.5) * 0.012;
    const lng = base
      ? base.longitude + (Math.random() - 0.5) * JITTER
      : SITE_CENTER.longitude + (Math.random() - 0.5) * 0.012;
    records.push({
      technicianId: tech.id,
      latitude: lat,
      longitude: lng,
      name: tech.name,
    });
  }

  await prisma.locationPing.createMany({
    data: records.map((r) => ({
      technicianId: r.technicianId,
      latitude: r.latitude,
      longitude: r.longitude,
    })),
  });

  publish(
    "location.ping",
    { simulated: true, count: records.length },
    { targetRoles: ["ADMIN", "DISPATCHER", "MANAGER"] }
  );

  return { count: records.length };
}

/** Status columns shown on the Kanban board. */
export const KANBAN_STATUSES = [
  "NOUVELLE",
  "PLANIFIEE",
  "EN_COURS",
  "EN_ATTENTE_PIECES",
  "TERMINEE",
  "CLOTUREE",
] as const;

export interface KanbanItem {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  requester: { name: string };
  assignments: { technician: { id: string; name: string } }[];
  createdAt: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  closedAt: string | null;
}

/**
 * Lightweight intervention list for the Kanban board, filtered through
 * the same role visibility rules as the requests list.
 */
export async function getKanbanRequests(user: TrackingUser): Promise<{
  items: KanbanItem[];
}> {
  const visibility: Prisma.InterventionWhereInput = {};
  switch (user.role) {
    case "CLIENT":
      visibility.requesterId = user.id;
      break;
    case "TECHNICIAN":
      visibility.OR = [
        { assignments: { some: { technicianId: user.id } } },
        { status: { in: ["NOUVELLE", "PLANIFIEE"] } },
      ];
      break;
    case "MANAGER":
      visibility.status = { notIn: ["ANNULEE"] };
      break;
    default:
      break;
  }

  const items = await prisma.intervention.findMany({
    where: {
      ...visibility,
      status: { in: [...KANBAN_STATUSES] },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 120,
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      plannedStart: true,
      plannedEnd: true,
      actualStart: true,
      actualEnd: true,
      closedAt: true,
      requester: { select: { name: true } },
      assignments: {
        select: { technician: { select: { id: true, name: true } } },
      },
    },
  });

  return {
    items: items.map((i) => ({
      id: i.id,
      reference: i.reference,
      title: i.title,
      status: i.status,
      priority: i.priority,
      requester: i.requester,
      assignments: i.assignments,
      createdAt: i.createdAt.toISOString(),
      plannedStart: i.plannedStart ? i.plannedStart.toISOString() : null,
      plannedEnd: i.plannedEnd ? i.plannedEnd.toISOString() : null,
      actualStart: i.actualStart ? i.actualStart.toISOString() : null,
      actualEnd: i.actualEnd ? i.actualEnd.toISOString() : null,
      closedAt: i.closedAt ? i.closedAt.toISOString() : null,
    })),
  };
}

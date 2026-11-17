import { prisma } from "@/lib/prisma";
import type { Priority, Role, Status } from "@prisma/client";

export interface DashboardUser {
  id: string;
  role: Role;
}

/** Statuses considered "still being worked on". */
export const OPEN_STATUSES: Status[] = [
  "NOUVELLE",
  "PLANIFIEE",
  "EN_COURS",
  "EN_ATTENTE_PIECES",
];

/** Compact intervention line rendered in dashboard lists. */
export interface DashItem {
  id: string;
  reference: string;
  title: string;
  status: Status;
  priority: Priority;
  createdAt: string;
  plannedStart: string | null;
  requester: string;
  technician: string | null;
  location: string | null;
}

const ITEM_SELECT = {
  id: true,
  reference: true,
  title: true,
  status: true,
  priority: true,
  createdAt: true,
  plannedStart: true,
  requester: { select: { name: true } },
  locationText: true,
  equipment: { select: { location: true } },
  assignments: {
    select: { technician: { select: { name: true } } },
    take: 1,
  },
} as const;

type ItemRow = {
  id: string;
  reference: string;
  title: string;
  status: Status;
  priority: Priority;
  createdAt: Date;
  plannedStart: Date | null;
  requester: { name: string };
  locationText: string | null;
  equipment: { location: string } | null;
  assignments: { technician: { name: string } }[];
};

function toItem(row: ItemRow): DashItem {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    plannedStart: row.plannedStart?.toISOString() ?? null,
    requester: row.requester.name,
    technician: row.assignments[0]?.technician.name ?? null,
    location: row.locationText ?? row.equipment?.location ?? null,
  };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function sumHours(rows: { actualStart: Date | null; actualEnd: Date | null; closedAt: Date | null }[]): number {
  return rows.reduce((total, row) => {
    const end = row.actualEnd ?? row.closedAt;
    if (!row.actualStart || !end) return total;
    return total + Math.max(0, (end.getTime() - row.actualStart.getTime()) / 3_600_000);
  }, 0);
}

// ---------------------------------------------------------------------------
// ADMIN — system health, accounts, stock alerts, activity log
// ---------------------------------------------------------------------------

export async function getAdminDashboard() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [usersByRole, inactiveUsers, interventions, openCount, lowStock, unassigned, recentUsers, activity, closedThisWeek] =
    await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.count({ where: { active: false } }),
      prisma.intervention.count(),
      prisma.intervention.count({ where: { status: { in: OPEN_STATUSES } } }),
      prisma.part.findMany({ orderBy: { quantity: "asc" }, take: 5 }),
      prisma.intervention.findMany({
        where: { status: "NOUVELLE", assignments: { none: {} } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 5,
        select: ITEM_SELECT,
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      }),
      prisma.statusHistory.findMany({
        orderBy: { changedAt: "desc" },
        take: 8,
        select: {
          id: true,
          toStatus: true,
          changedAt: true,
          changedByUser: { select: { name: true } },
          intervention: { select: { id: true, reference: true, title: true } },
        },
      }),
      prisma.intervention.count({
        where: { status: { in: ["TERMINEE", "CLOTUREE"] }, updatedAt: { gte: since } },
      }),
    ]);

  const roleCounts = new Map(usersByRole.map((r) => [r.role, r._count._all]));
  const totalUsers = usersByRole.reduce((s, r) => s + r._count._all, 0);

  return {
    totalUsers,
    roleCounts: {
      ADMIN: roleCounts.get("ADMIN") ?? 0,
      DISPATCHER: roleCounts.get("DISPATCHER") ?? 0,
      TECHNICIAN: roleCounts.get("TECHNICIAN") ?? 0,
      MANAGER: roleCounts.get("MANAGER") ?? 0,
      CLIENT: roleCounts.get("CLIENT") ?? 0,
    },
    inactiveUsers,
    interventions,
    openCount,
    closedThisWeek,
    lowStock: lowStock.map((p) => ({
      id: p.id,
      reference: p.reference,
      name: p.name,
      quantity: p.quantity,
      minThreshold: p.minThreshold,
      location: p.location,
    })),
    unassigned: unassigned.map(toItem),
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
    })),
    activity: activity.map((a) => ({
      id: a.id,
      toStatus: a.toStatus,
      actor: a.changedByUser.name,
      changedAt: a.changedAt.toISOString(),
      interventionId: a.intervention.id,
      reference: a.intervention.reference,
      title: a.intervention.title,
    })),
  };
}

// ---------------------------------------------------------------------------
// DISPATCHER — dispatch queue, day plan, technician workload
// ---------------------------------------------------------------------------

export async function getDispatcherDashboard() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekEnd = endOfDay(new Date(now.getTime() + 7 * 86_400_000));

  const [unassigned, todayPlan, weekPlan, technicians, availability, waitingParts, lowStock, newCount] =
    await Promise.all([
      prisma.intervention.findMany({
        where: { status: "NOUVELLE", assignments: { none: {} } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 6,
        select: ITEM_SELECT,
      }),
      prisma.intervention.findMany({
        where: {
          status: { in: ["PLANIFIEE", "EN_COURS"] },
          plannedStart: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { plannedStart: "asc" },
        take: 8,
        select: ITEM_SELECT,
      }),
      prisma.intervention.count({
        where: {
          status: { in: ["PLANIFIEE", "EN_COURS"] },
          plannedStart: { gte: dayEnd, lt: weekEnd },
        },
      }),
      prisma.user.findMany({
        where: { role: "TECHNICIAN", active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          assignedAssignments: {
            where: { intervention: { status: { in: OPEN_STATUSES } } },
            select: { intervention: { select: { status: true, priority: true } } },
          },
        },
      }),
      prisma.availability.findMany({
        where: { start: { lt: dayEnd }, end: { gte: dayStart } },
        select: { technicianId: true, type: true },
      }),
      prisma.intervention.findMany({
        where: { status: "EN_ATTENTE_PIECES" },
        orderBy: { updatedAt: "asc" },
        take: 5,
        select: ITEM_SELECT,
      }),
      prisma.part.findMany({ orderBy: { quantity: "asc" }, take: 4 }),
      prisma.intervention.count({ where: { status: "NOUVELLE" } }),
    ]);

  const away = new Map(availability.map((a) => [a.technicianId, a.type]));

  return {
    newCount,
    unassigned: unassigned.map(toItem),
    todayPlan: todayPlan.map(toItem),
    todayPlanCount: todayPlan.length,
    weekPlan,
    technicianLoad: technicians.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      open: t.assignedAssignments.length,
      critical: t.assignedAssignments.filter(
        (a) => a.intervention.status !== "EN_ATTENTE_PIECES" && a.intervention.priority === "CRITICAL"
      ).length,
      available: !away.has(t.id),
      awayType: away.get(t.id) ?? null,
    })),
    waitingParts: waitingParts.map(toItem),
    lowStock: lowStock
      .filter((p) => p.quantity < p.minThreshold)
      .map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        minThreshold: p.minThreshold,
      })),
  };
}

// ---------------------------------------------------------------------------
// TECHNICIAN — my day, my workload, parts I used, my skills
// ---------------------------------------------------------------------------

export async function getTechnicianDashboard(user: DashboardUser) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekStart = startOfDay(new Date(now.getTime() - 7 * 86_400_000));

  const [mine, allMine, partsUsed, skills, waitingParts] = await Promise.all([
    prisma.intervention.findMany({
      where: {
        assignments: { some: { technicianId: user.id } },
        status: { in: OPEN_STATUSES },
      },
      orderBy: [{ priority: "desc" }, { plannedStart: "asc" }],
      take: 6,
      select: ITEM_SELECT,
    }),
    prisma.intervention.findMany({
      where: { assignments: { some: { technicianId: user.id } } },
      select: {
        id: true,
        status: true,
        priority: true,
        plannedStart: true,
        plannedEnd: true,
        actualStart: true,
        actualEnd: true,
        closedAt: true,
        satisfactionRating: true,
      },
    }),
    prisma.partUsage.findMany({
      where: { usedBy: user.id },
      orderBy: { usedAt: "desc" },
      take: 5,
      select: {
        id: true,
        quantity: true,
        usedAt: true,
        part: { select: { name: true, unitCost: true } },
        intervention: { select: { id: true, reference: true } },
      },
    }),
    prisma.technicianSkill.findMany({
      where: { technicianId: user.id },
      orderBy: { level: "desc" },
      select: { id: true, level: true, skill: { select: { name: true } } },
    }),
    prisma.intervention.findMany({
      where: {
        assignments: { some: { technicianId: user.id } },
        status: "EN_ATTENTE_PIECES",
      },
      orderBy: { updatedAt: "asc" },
      take: 4,
      select: ITEM_SELECT,
    }),
  ]);

  const done = allMine.filter((i) => i.status === "TERMINEE" || i.status === "CLOTUREE");
  const doneThisWeek = done.filter((i) => (i.actualEnd ?? i.closedAt ?? i.plannedStart ?? now) >= weekStart);
  const ratings = done
    .map((i) => i.satisfactionRating)
    .filter((r): r is number => r !== null);
  const overdue = allMine.filter(
    (i) =>
      OPEN_STATUSES.includes(i.status) &&
      i.plannedEnd !== null &&
      i.plannedEnd.getTime() < now.getTime()
  );

  return {
    today: mine.filter(
      (i) =>
        i.plannedStart !== null &&
        i.plannedStart.getTime() >= dayStart.getTime() &&
        i.plannedStart.getTime() < dayEnd.getTime()
    ).map(toItem),
    current: mine.filter((i) => i.status === "EN_COURS").map(toItem),
    queue: mine.map(toItem),
    openCount: allMine.filter((i) => OPEN_STATUSES.includes(i.status)).length,
    overdueCount: overdue.length,
    doneThisWeek: doneThisWeek.length,
    hoursThisWeek: Number(sumHours(doneThisWeek).toFixed(1)),
    satisfaction:
      ratings.length > 0
        ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
        : null,
    partsUsed: partsUsed.map((u) => ({
      id: u.id,
      name: u.part.name,
      quantity: u.quantity,
      cost: u.quantity * u.part.unitCost,
      usedAt: u.usedAt.toISOString(),
      interventionId: u.intervention.id,
      reference: u.intervention.reference,
    })),
    skills: skills.map((s) => ({ id: s.id, name: s.skill.name, level: s.level })),
    waitingParts: waitingParts.map(toItem),
  };
}

// ---------------------------------------------------------------------------
// CLIENT — my requests, their progress, feedback, my equipment
// ---------------------------------------------------------------------------

export async function getClientDashboard(user: DashboardUser) {
  const [rows, open, toRate, feedback] = await Promise.all([
    prisma.intervention.findMany({
      where: { requesterId: user.id },
      select: {
        id: true,
        status: true,
        satisfactionRating: true,
        equipment: { select: { name: true, location: true, category: true } },
      },
    }),
    prisma.intervention.findMany({
      where: { requesterId: user.id, status: { in: OPEN_STATUSES } },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
      select: ITEM_SELECT,
    }),
    prisma.intervention.findMany({
      where: { requesterId: user.id, status: "CLOTUREE", satisfactionRating: null },
      orderBy: { closedAt: "desc" },
      take: 4,
      select: { id: true, reference: true, title: true, closedAt: true },
    }),
    prisma.intervention.findMany({
      where: { requesterId: user.id, satisfactionRating: { not: null } },
      orderBy: { closedAt: "desc" },
      take: 3,
      select: {
        id: true,
        reference: true,
        title: true,
        satisfactionRating: true,
        satisfactionComment: true,
        closedAt: true,
      },
    }),
  ]);

  const count = (status: Status) => rows.filter((r) => r.status === status).length;
  const equipment = new Map<string, { name: string; location: string; category: string }>();
  for (const row of rows) {
    if (row.equipment) {
      equipment.set(row.equipment.name, row.equipment);
    }
  }
  const ratings = rows
    .map((r) => r.satisfactionRating)
    .filter((r): r is number => r !== null);

  return {
    open: open.map(toItem),
    stats: {
      total: rows.length,
      open: rows.filter((r) => OPEN_STATUSES.includes(r.status)).length,
      inProgress: count("EN_COURS"),
      waitingParts: count("EN_ATTENTE_PIECES"),
      closed: count("CLOTUREE"),
      cancelled: count("ANNULEE"),
    },
    avgSatisfaction:
      ratings.length > 0
        ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
        : null,
    toRate: toRate.map((i) => ({
      id: i.id,
      reference: i.reference,
      title: i.title,
      closedAt: i.closedAt?.toISOString() ?? null,
    })),
    feedback: feedback.map((i) => ({
      id: i.id,
      reference: i.reference,
      title: i.title,
      rating: i.satisfactionRating ?? 0,
      comment: i.satisfactionComment,
      closedAt: i.closedAt?.toISOString() ?? null,
    })),
    equipment: [...equipment.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---------------------------------------------------------------------------
// MANAGER — service performance, backlog aging, team scoreboard, feedback
// ---------------------------------------------------------------------------

export async function getManagerDashboard() {
  const now = new Date();
  const weekStart = startOfDay(new Date(now.getTime() - 7 * 86_400_000));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  const [rows, technicians, feedback, weekly] = await Promise.all([
    prisma.intervention.findMany({
      select: {
        id: true,
        status: true,
        type: true,
        createdAt: true,
        plannedEnd: true,
        actualEnd: true,
        closedAt: true,
        actualStart: true,
        satisfactionRating: true,
        assignments: { select: { technician: { select: { id: true, name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { role: "TECHNICIAN", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.intervention.findMany({
      where: { satisfactionComment: { not: null } },
      orderBy: { closedAt: "desc" },
      take: 4,
      select: {
        id: true,
        reference: true,
        title: true,
        satisfactionRating: true,
        satisfactionComment: true,
        closedAt: true,
      },
    }),
    Promise.all(
      Array.from({ length: 6 }).map(async (_, index) => {
        const start = startOfDay(new Date(now.getTime() - (5 - index) * 7 * 86_400_000));
        const end = new Date(start.getTime() + 7 * 86_400_000);
        const [opened, closed] = await Promise.all([
          prisma.intervention.count({ where: { createdAt: { gte: start, lt: end } } }),
          prisma.intervention.count({
            where: { status: { in: ["TERMINEE", "CLOTUREE"] }, updatedAt: { gte: start, lt: end } },
          }),
        ]);
        return {
          label: `S${start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`,
          opened,
          closed,
        };
      })
    ),
  ]);

  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const aging = (days: number) =>
    open.filter((r) => now.getTime() - r.createdAt.getTime() > days * 86_400_000).length;

  const done = rows.filter((r) => r.status === "TERMINEE" || r.status === "CLOTUREE");
  const closedMonth = done.filter(
    (r) => (r.actualEnd ?? r.closedAt ?? r.createdAt) >= monthStart
  );
  const closedWeek = done.filter(
    (r) => (r.actualEnd ?? r.closedAt ?? r.createdAt) >= weekStart
  );

  const performance = technicians.map((t) => {
    const own = done.filter((r) => r.assignments.some((a) => a.technician.id === t.id));
    const delayed = own.filter((r) => {
      const end = r.actualEnd ?? r.closedAt;
      return end !== null && r.plannedEnd !== null && end.getTime() > r.plannedEnd.getTime();
    });
    const ratings = own
      .map((r) => r.satisfactionRating)
      .filter((r): r is number => r !== null);
    return {
      id: t.id,
      name: t.name,
      completed: own.length,
      delayed: delayed.length,
      hours: Number(sumHours(own).toFixed(1)),
      satisfaction:
        ratings.length > 0
          ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
          : null,
      active: open.filter((r) => r.assignments.some((a) => a.technician.id === t.id)).length,
    };
  });

  const ratings = done
    .map((r) => r.satisfactionRating)
    .filter((r): r is number => r !== null);

  return {
    openCount: open.length,
    closedWeek: closedWeek.length,
    closedMonth: closedMonth.length,
    backlog7: aging(7),
    backlog30: aging(30),
    preventiveShare:
      rows.length > 0
        ? Number(
            ((rows.filter((r) => r.type === "PREVENTIVE").length / rows.length) * 100).toFixed(0)
          )
        : 0,
    satisfaction:
      ratings.length > 0
        ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
        : null,
    team: performance.sort((a, b) => b.completed - a.completed),
    weekly,
    feedback: feedback.map((f) => ({
      id: f.id,
      reference: f.reference,
      title: f.title,
      rating: f.satisfactionRating,
      comment: f.satisfactionComment,
      closedAt: f.closedAt?.toISOString() ?? null,
    })),
  };
}

export type AdminDashboard = Awaited<ReturnType<typeof getAdminDashboard>>;
export type DispatcherDashboard = Awaited<ReturnType<typeof getDispatcherDashboard>>;
export type TechnicianDashboard = Awaited<ReturnType<typeof getTechnicianDashboard>>;
export type ClientDashboard = Awaited<ReturnType<typeof getClientDashboard>>;
export type ManagerDashboard = Awaited<ReturnType<typeof getManagerDashboard>>;

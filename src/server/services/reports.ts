import { prisma } from "@/lib/prisma";
import type { Prisma, Role, Status } from "@prisma/client";

export interface ReportsUser {
  id: string;
  role: Role;
}

export interface DashboardKpis {
  total: number;
  byStatus: { key: string; count: number }[];
  byType: { key: string; count: number }[];
  byPriority: { key: string; count: number }[];
  avgResolutionHours: number | null;
  delayRate: number | null;
  delayedCount: number;
  completedCount: number;
  avgSatisfaction: number | null;
  ratingCount: number;
  partsCostTotal: number;
  partsCostMonth: number;
  partsUnitsMonth: number;
  monthlyVolume: { month: string; count: number }[];
  technicianUtilization: {
    id: string;
    name: string;
    active: number;
    completed: number;
    hours: number;
  }[];
}

/** Role scoping: CLIENT sees own, TECHNICIAN sees assigned, others see all. */
function scopeFor(user: ReportsUser): Prisma.InterventionWhereInput {
  if (user.role === "CLIENT") {
    return { requesterId: user.id };
  }
  if (user.role === "TECHNICIAN") {
    return {
      OR: [
        { assignments: { some: { technicianId: user.id } } },
        { status: { in: ["NOUVELLE", "PLANIFIEE"] satisfies Status[] } },
      ],
    };
  }
  return {};
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function countBy(
  items: { key: string }[]
): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.key, (map.get(item.key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Global dashboard KPIs (role-scoped): status/type/priority breakdowns,
 * average resolution time, delay rate, technician utilization, parts
 * consumption/cost and average satisfaction.
 */
export async function getDashboardKpis(user: ReportsUser): Promise<DashboardKpis> {
  const scope = scopeFor(user);

  const interventions = await prisma.intervention.findMany({
    where: scope,
    select: {
      type: true,
      priority: true,
      status: true,
      plannedStart: true,
      plannedEnd: true,
      actualStart: true,
      actualEnd: true,
      closedAt: true,
      createdAt: true,
      satisfactionRating: true,
      assignments: {
        select: {
          technician: { select: { id: true, name: true } },
        },
      },
      partUsages: {
        select: {
          quantity: true,
          usedAt: true,
          part: { select: { unitCost: true } },
        },
      },
    },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Resolution time in hours (actual dates, fallback closedAt).
  const resolutionHours = interventions
    .filter((i) => i.actualStart && (i.actualEnd ?? i.closedAt))
    .map(
      (i) =>
        ((i.actualEnd ?? i.closedAt as Date).getTime() -
          (i.actualStart as Date).getTime()) /
        3_600_000
    )
    .filter((h) => h >= 0);

  // Delay rate over interventions with a planned end and a real end.
  const withBothDates = interventions.filter((i) => i.plannedEnd && (i.actualEnd ?? i.closedAt));
  const delayed = withBothDates.filter(
    (i) => (i.actualEnd ?? i.closedAt as Date).getTime() > i.plannedEnd!.getTime()
  );

  // Parts consumption.
  const monthUsages = interventions
    .flatMap((i) => i.partUsages)
    .filter((u) => u.usedAt >= monthStart);
  const partsCostTotal = interventions
    .flatMap((i) => i.partUsages)
    .reduce((s, u) => s + u.quantity * u.part.unitCost, 0);
  const partsCostMonth = monthUsages.reduce(
    (s, u) => s + u.quantity * u.part.unitCost,
    0
  );
  const partsUnitsMonth = monthUsages.reduce((s, u) => s + u.quantity, 0);

  // Monthly volume over the last 6 months.
  const monthlyVolume: { month: string; count: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    const start = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - k + 1, 1);
    const label = start.toLocaleDateString("fr-FR", { month: "short" });
    monthlyVolume.push({
      month: label,
      count: interventions.filter((i) => i.createdAt >= start && i.createdAt < end)
        .length,
    });
  }

  // Technician utilization.
  const techMap = new Map<
    string,
    { id: string; name: string; active: number; completed: number; hours: number }
  >();
  for (const i of interventions) {
    for (const a of i.assignments) {
      const entry = techMap.get(a.technician.id) ?? {
        id: a.technician.id,
        name: a.technician.name,
        active: 0,
        completed: 0,
        hours: 0,
      };
      if (i.status === "EN_COURS") entry.active++;
      if (i.status === "TERMINEE" || i.status === "CLOTUREE") {
        entry.completed++;
        if (i.actualStart && (i.actualEnd ?? i.closedAt)) {
          entry.hours +=
            ((i.actualEnd ?? i.closedAt as Date).getTime() - i.actualStart.getTime()) /
            3_600_000;
        }
      }
      techMap.set(a.technician.id, entry);
    }
  }

  const ratings = interventions
    .map((i) => i.satisfactionRating)
    .filter((r): r is number => r !== null);

  const statusOrder = [
    "NOUVELLE",
    "PLANIFIEE",
    "EN_COURS",
    "EN_ATTENTE_PIECES",
    "TERMINEE",
    "CLOTUREE",
    "ANNULEE",
  ];
  const byStatus = countBy(interventions.map((i) => ({ key: i.status }))).sort(
    (a, b) => statusOrder.indexOf(a.key) - statusOrder.indexOf(b.key)
  );

  return {
    total: interventions.length,
    byStatus,
    byType: countBy(interventions.map((i) => ({ key: i.type }))),
    byPriority: countBy(interventions.map((i) => ({ key: i.priority }))),
    avgResolutionHours: avg(resolutionHours),
    delayRate:
      withBothDates.length > 0 ? delayed.length / withBothDates.length : null,
    delayedCount: delayed.length,
    completedCount: withBothDates.length,
    avgSatisfaction: avg(ratings),
    ratingCount: ratings.length,
    partsCostTotal,
    partsCostMonth,
    partsUnitsMonth,
    monthlyVolume,
    technicianUtilization: [...techMap.values()].sort(
      (a, b) => b.completed + b.active - (a.completed + a.active)
    ),
  };
}

/** Flat CSV export of interventions (office roles). */
export async function buildInterventionsCsv(user: ReportsUser): Promise<string> {
  if (
    !["ADMIN", "DISPATCHER", "MANAGER"].includes(user.role)
  ) {
    throw new Error("Export réservé aux rôles internes");
  }

  const rows = await prisma.intervention.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      reference: true,
      title: true,
      type: true,
      priority: true,
      status: true,
      createdAt: true,
      closedAt: true,
      plannedStart: true,
      plannedEnd: true,
      actualStart: true,
      actualEnd: true,
      satisfactionRating: true,
      requester: { select: { name: true } },
      equipment: { select: { name: true } },
      partUsages: {
        select: { quantity: true, part: { select: { unitCost: true, name: true } } },
      },
    },
  });

  const esc = (value: unknown): string => {
    const s = String(value ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [
    "Référence;Titre;Type;Priorité;Statut;Demandeur;Équipement;Créée le;Clôturée le;Début prévu;Fin prévue;Début réel;Fin réelle;Satisfaction;Pièces;Coût pièces (MAD)",
  ];
  for (const r of rows) {
    const cost = r.partUsages.reduce(
      (s, u) => s + u.quantity * u.part.unitCost,
      0
    );
    const partsText = r.partUsages
      .map((u) => `${u.part.name} x${u.quantity}`)
      .join(" | ");
    lines.push(
      [
        r.reference,
        r.title,
        r.type,
        r.priority,
        r.status,
        r.requester.name,
        r.equipment?.name ?? "",
        r.createdAt.toISOString(),
        r.closedAt?.toISOString() ?? "",
        r.plannedStart?.toISOString() ?? "",
        r.plannedEnd?.toISOString() ?? "",
        r.actualStart?.toISOString() ?? "",
        r.actualEnd?.toISOString() ?? "",
        r.satisfactionRating ?? "",
        partsText,
        cost.toFixed(2),
      ]
        .map(esc)
        .join(";")
    );
  }
  // BOM so Excel opens UTF-8 accents correctly.
  return "\uFEFF" + lines.join("\r\n");
}

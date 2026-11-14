import { prisma } from "@/lib/prisma";
import { nextReference } from "@/lib/reference";
import { publish } from "@/lib/events";
import { ApiError } from "@/lib/api-helpers";
import type { ListQuery } from "@/validation/intervention";
import type {
  InterventionCreateInput,
  InterventionUpdateInput,
} from "@/validation/intervention";
import type { Prisma, Status, User } from "@prisma/client";

/** Which users can see a given intervention (used for list filtering). */
export function visibilityFilter(
  user: Pick<User, "id" | "role">,
  filters: ListQuery
): Prisma.InterventionWhereInput {
  const where: Prisma.InterventionWhereInput = {};

  switch (user.role) {
    case "CLIENT":
      // Clients only see their own requests.
      where.requesterId = user.id;
      break;
    case "TECHNICIAN":
      // Technicians see interventions assigned to them.
      where.assignments = { some: { technicianId: user.id } };
      break;
    // ADMIN, DISPATCHER, MANAGER see everything.
    default:
      break;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { reference: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.priority) where.priority = filters.priority;
  if (filters.requesterId) where.requesterId = filters.requesterId;
  if (filters.equipmentId) where.equipmentId = filters.equipmentId;

  return where;
}

/** Paginated, filtered list. */
export async function listRequests(user: Pick<User, "id" | "role">, query: ListQuery) {
  const where = visibilityFilter(user, query);
  const { page, pageSize } = query;

  const [total, items] = await Promise.all([
    prisma.intervention.count({ where }),
    prisma.intervention.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, location: true } },
        requiredSkill: { select: { id: true, name: true } },
        assignments: {
          include: { technician: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) || 1 };
}

/** Full detail (with history, comments, attachments, incidents, usage). */
export async function getRequest(user: Pick<User, "id" | "role">, id: string) {
  const request = await prisma.intervention.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      equipment: true,
      requiredSkill: true,
      assignments: {
        include: { technician: { select: { id: true, name: true, email: true } } },
      },
      statusHistory: {
        include: { changedByUser: { select: { id: true, name: true } } },
        orderBy: { changedAt: "asc" },
      },
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        include: { uploadedByUser: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      incidents: { orderBy: { reportedAt: "desc" } },
      partUsages: {
        include: { part: true, user: { select: { id: true, name: true } } },
        orderBy: { usedAt: "asc" },
      },
      reports: { orderBy: { generatedAt: "desc" } },
    },
  });

  if (!request) throw new ApiError(404, "Intervention introuvable");

  // Visibility enforcement
  const allowed =
    user.role === "ADMIN" ||
    user.role === "DISPATCHER" ||
    user.role === "MANAGER" ||
    request.requesterId === user.id ||
    request.assignments.some((a) => a.technicianId === user.id);

  if (!allowed) throw new ApiError(403, "Accès refusé");

  return request;
}

/** Create a new request (reference generation inside a transaction). */
export async function createRequest(
  user: Pick<User, "id" | "role">,
  input: InterventionCreateInput
) {
  const request = await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx);
    return tx.intervention.create({
      data: {
        reference,
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        status: "NOUVELLE",
        requesterId: user.id,
        equipmentId: input.equipmentId ?? undefined,
        locationText: input.locationText ?? undefined,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        requiredSkillId: input.requiredSkillId ?? undefined,
        plannedStart: input.plannedStart ?? undefined,
        plannedEnd: input.plannedEnd ?? undefined,
      },
    });
  });

  await prisma.statusHistory.create({
    data: {
      interventionId: request.id,
      fromStatus: null,
      toStatus: "NOUVELLE",
      changedBy: user.id,
      comment: "Demande créée",
    },
  });

  // Notify office staff
  const office = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "DISPATCHER"] }, active: true },
    select: { id: true },
  });
  const { notifyUsers } = await import("@/lib/notifications");
  await notifyUsers({
    userIds: office.map((u) => u.id),
    message: `Nouvelle demande ${request.reference} : « ${request.title} »`,
  });

  publish("intervention.created", { id: request.id, reference: request.reference });

  return request;
}

/** Update editable fields (server validates role rules). */
export async function updateRequest(
  user: Pick<User, "id" | "role">,
  id: string,
  input: InterventionUpdateInput
) {
  const existing = await prisma.intervention.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Intervention introuvable");

  const canEdit =
    user.role === "ADMIN" ||
    user.role === "DISPATCHER" ||
    (user.role === "CLIENT" && existing.requesterId === user.id && existing.status === "NOUVELLE");

  if (!canEdit) throw new ApiError(403, "Modification non autorisée");

  const updated = await prisma.intervention.update({
    where: { id },
    data: {
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      type: input.type ?? undefined,
      priority: input.priority ?? undefined,
      equipmentId: input.equipmentId !== undefined ? input.equipmentId : undefined,
      locationText: input.locationText !== undefined ? input.locationText : undefined,
      latitude: input.latitude !== undefined ? input.latitude : undefined,
      longitude: input.longitude !== undefined ? input.longitude : undefined,
      requiredSkillId: input.requiredSkillId !== undefined ? input.requiredSkillId : undefined,
      plannedStart: input.plannedStart !== undefined ? input.plannedStart : undefined,
      plannedEnd: input.plannedEnd !== undefined ? input.plannedEnd : undefined,
    },
  });

  publish("intervention.updated", { id, reference: updated.reference });
  return updated;
}

/** Hard delete, restricted to ADMIN. */
export async function deleteRequest(id: string) {
  const existing = await prisma.intervention.findUnique({
    where: { id },
    include: { _count: { select: { statusHistory: true } } },
  });
  if (!existing) throw new ApiError(404, "Intervention introuvable");
  if (existing._count.statusHistory > 1) {
    throw new ApiError(409, "Une intervention avec historique ne peut pas être supprimée");
  }
  await prisma.intervention.delete({ where: { id } });
  publish("intervention.updated", { id, deleted: true });
}

/** Change status with transition validation + history + notifications. */
export async function changeStatus(
  user: Pick<User, "id" | "role">,
  id: string,
  toStatus: Status,
  comment?: string
) {
  const existing = await prisma.intervention.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Intervention introuvable");

  const { canTransition } = await import("@/lib/status");
  if (!canTransition(existing.status, toStatus)) {
    throw new ApiError(
      409,
      `Transition invalide : ${existing.status} → ${toStatus}`
    );
  }

  // Who can transition what
  const roleAllowed =
    user.role === "ADMIN" ||
    user.role === "DISPATCHER" ||
    // Technicians drive their assigned interventions through the field states
    (user.role === "TECHNICIAN" &&
      ["EN_COURS", "EN_ATTENTE_PIECES", "TERMINEE"].includes(toStatus) &&
      (await prisma.assignment.findFirst({
        where: { interventionId: id, technicianId: user.id },
      })) !== null) ||
    // A client can cancel their own new request
    (user.role === "CLIENT" &&
      toStatus === "ANNULEE" &&
      existing.requesterId === user.id &&
      existing.status === "NOUVELLE");

  if (!roleAllowed) throw new ApiError(403, "Changement de statut non autorisé");

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const intervention = await tx.intervention.update({
      where: { id },
      data: {
        status: toStatus,
        actualStart: toStatus === "EN_COURS" && !existing.actualStart ? now : undefined,
        actualEnd: toStatus === "TERMINEE" ? now : undefined,
        closedAt: toStatus === "CLOTUREE" ? now : undefined,
      },
    });

    await tx.statusHistory.create({
      data: {
        interventionId: id,
        fromStatus: existing.status,
        toStatus,
        changedBy: user.id,
        comment,
      },
    });

    return intervention;
  });

  // Notify stakeholders: requester + assigned technician + office
  const assignments = await prisma.assignment.findMany({
    where: { interventionId: id },
    select: { technicianId: true },
  });
  const targets = [
    existing.requesterId,
    ...assignments.map((a) => a.technicianId),
    ...(user.role !== "DISPATCHER" ? [] : [user.id]),
  ];
  const unique = Array.from(new Set(targets));

  const { notifyUsers } = await import("@/lib/notifications");
  await notifyUsers({
    userIds: unique.filter((uid) => uid !== user.id),
    message: `Intervention ${existing.reference} : ${existing.status} → ${toStatus}`,
  });

  publish("intervention.status", {
    id,
    reference: existing.reference,
    fromStatus: existing.status,
    toStatus,
  });

  return updated;
}

/** Satisfaction rating set by the requester at closing. */
export async function rateIntervention(
  user: Pick<User, "id" | "role">,
  id: string,
  rating: number,
  comment?: string
) {
  const existing = await prisma.intervention.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Intervention introuvable");
  if (existing.requesterId !== user.id) {
    throw new ApiError(403, "Seul le demandeur peut noter l'intervention");
  }
  if (existing.status !== "CLOTUREE") {
    throw new ApiError(409, "La notation est possible après clôture");
  }
  if (existing.satisfactionRating) {
    throw new ApiError(409, "L'intervention est déjà notée");
  }

  return prisma.intervention.update({
    where: { id },
    data: { satisfactionRating: rating, satisfactionComment: comment },
  });
}

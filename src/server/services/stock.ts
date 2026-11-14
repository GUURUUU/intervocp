import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/events";
import { ApiError } from "@/lib/api-helpers";
import { notifyUsers } from "@/lib/notifications";
import type { Role } from "@prisma/client";
import type { PartInput, PartUpdateInput, RestockInput } from "@/validation/stock";

export interface StockUser {
  id: string;
  role: Role;
}

const STOCK_VIEWERS: Role[] = ["ADMIN", "DISPATCHER", "TECHNICIAN", "MANAGER"];
const STOCK_MANAGERS: Role[] = ["ADMIN", "DISPATCHER"];

function assertStockAccess(user: StockUser): void {
  if (!STOCK_VIEWERS.includes(user.role)) {
    throw new ApiError(403, "Accès au stock non autorisé pour ce rôle");
  }
}

function assertStockManager(user: StockUser): void {
  if (!STOCK_MANAGERS.includes(user.role)) {
    throw new ApiError(403, "Gestion du stock réservée à l'encadrement");
  }
}

/** Parts catalogue with search + low-stock filter. */
export async function listParts(
  user: StockUser,
  options: { search?: string; lowOnly?: boolean } = {}
) {
  assertStockAccess(user);

  const parts = await prisma.part.findMany({
    where: {
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search } },
              { reference: { contains: options.search } },
            ],
          }
        : {}),
      ...(options.lowOnly
        ? { quantity: { lt: 5 } } // refined below via threshold comparison
        : {}),
    },
    orderBy: { name: "asc" },
  });

  // minThreshold is per-part: filter low stock in memory.
  const filtered = options.lowOnly
    ? parts.filter((p) => p.quantity < p.minThreshold)
    : parts;

  return {
    items: filtered,
    lowCount: parts.filter((p) => p.quantity < p.minThreshold).length,
  };
}

/** Creates a catalogue entry (ADMIN only). */
export async function createPart(user: StockUser, input: PartInput) {
  if (user.role !== "ADMIN") {
    throw new ApiError(403, "Création de pièce réservée à l'administrateur");
  }
  const existing = await prisma.part.findUnique({
    where: { reference: input.reference },
  });
  if (existing) {
    throw new ApiError(409, "Une pièce avec cette référence existe déjà");
  }

  const part = await prisma.part.create({
    data: {
      reference: input.reference,
      name: input.name,
      quantity: input.quantity,
      minThreshold: input.minThreshold,
      unitCost: input.unitCost,
      location: input.location ?? null,
    },
  });

  // Initial stock is logged as an adjustment movement.
  if (part.quantity > 0) {
    await prisma.stockMovement.create({
      data: { partId: part.id, delta: part.quantity, reason: "ADJUSTMENT" },
    });
  }
  if (part.quantity < part.minThreshold) {
    publish("stock.low", { partId: part.id, reference: part.reference });
  }
  return part;
}

/** Updates catalogue metadata (ADMIN only). Quantity changes go through restock. */
export async function updatePart(
  user: StockUser,
  id: string,
  input: PartUpdateInput
) {
  if (user.role !== "ADMIN") {
    throw new ApiError(403, "Modification de pièce réservée à l'administrateur");
  }
  const part = await prisma.part.findUnique({ where: { id } });
  if (!part) throw new ApiError(404, "Pièce introuvable");

  return prisma.part.update({
    where: { id },
    data: {
      name: input.name ?? part.name,
      minThreshold: input.minThreshold ?? part.minThreshold,
      unitCost: input.unitCost ?? part.unitCost,
      location: input.location === undefined ? part.location : input.location,
    },
  });
}

/** Stock-in operation (ADMIN/DISPATCHER) with a movement log. */
export async function restockPart(user: StockUser, id: string, input: RestockInput) {
  assertStockManager(user);

  const result = await prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({ where: { id } });
    if (!part) throw new ApiError(404, "Pièce introuvable");

    const updated = await tx.part.update({
      where: { id },
      data: { quantity: { increment: input.quantity } },
    });
    await tx.stockMovement.create({
      data: { partId: id, delta: input.quantity, reason: "RESTOCK" },
    });
    return updated;
  });

  return result;
}

/**
 * Technician declares parts used on an intervention: stock decreases
 * automatically, a StockMovement is logged, and a low-stock alert is
 * published when the quantity drops under the threshold.
 */
export async function declarePartUsage(
  user: StockUser,
  interventionId: string,
  partId: string,
  quantity: number
) {
  if (user.role !== "TECHNICIAN" && !STOCK_MANAGERS.includes(user.role)) {
    throw new ApiError(403, "Seuls les techniciens et l'encadrement peuvent déclarer des pièces");
  }

  const intervention = await prisma.intervention.findUnique({
    where: { id: interventionId },
    include: { assignments: { select: { technicianId: true } } },
  });
  if (!intervention) throw new ApiError(404, "Intervention introuvable");

  if (
    user.role === "TECHNICIAN" &&
    !intervention.assignments.some((a) => a.technicianId === user.id)
  ) {
    throw new ApiError(403, "Vous devez être affecté à cette intervention");
  }

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) throw new ApiError(404, "Pièce introuvable");

  if (part.quantity < quantity) {
    throw new ApiError(
      409,
      `Stock insuffisant pour ${part.name} (disponible : ${part.quantity})`
    );
  }

  const usage = await prisma.$transaction(async (tx) => {
    const created = await tx.partUsage.create({
      data: {
        interventionId,
        partId,
        quantity,
        usedBy: user.id,
      },
      include: {
        part: { select: { id: true, name: true, reference: true, unitCost: true } },
        user: { select: { id: true, name: true } },
      },
    });
    const updatedPart = await tx.part.update({
      where: { id: partId },
      data: { quantity: { decrement: quantity } },
    });
    await tx.stockMovement.create({
      data: { partId, delta: -quantity, reason: "USAGE" },
    });
    return { usage: created, part: updatedPart };
  });

  // Low-stock alert (SSE + notification) when under threshold.
  if (usage.part.quantity < usage.part.minThreshold) {
    publish("stock.low", {
      partId: usage.part.id,
      reference: usage.part.reference,
      quantity: usage.part.quantity,
    });
    const recipients = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "DISPATCHER"] } },
      select: { id: true },
    });
    await notifyUsers({
      userIds: recipients.map((r) => r.id),
      message: `Stock bas : ${usage.part.name} (${usage.part.quantity} restants)`,
    });
  }

  publish(
    "intervention.updated",
    { id: interventionId, partUsed: true },
    { targetUserIds: [intervention.requesterId] }
  );

  return usage;
}

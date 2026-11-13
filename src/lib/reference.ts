import type { Prisma } from "@prisma/client";

/**
 * Generates the next readable intervention reference: INT-<year>-<0001>.
 * Must be called inside a transaction to stay race-safe.
 */
export async function nextReference(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INT-${year}-`;

  const last = await tx.intervention.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
  });

  const lastNumber = last
    ? parseInt(last.reference.slice(prefix.length), 10)
    : 0;

  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

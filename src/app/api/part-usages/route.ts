import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import { declarePartUsage } from "@/server/services/stock";
import { partUsageSchema } from "@/validation/stock";

/**
 * POST: technician declares parts used on an intervention — stock
 * decreases automatically with a StockMovement log + low-stock alert.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession([
      "ADMIN",
      "DISPATCHER",
      "TECHNICIAN",
    ]);
    const input = partUsageSchema.parse(await parseJson(request));
    const usage = await declarePartUsage(
      session.user,
      input.interventionId,
      input.partId,
      input.quantity
    );
    return NextResponse.json(usage, { status: 201 });
  });
}

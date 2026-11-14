import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import { restockPart } from "@/server/services/stock";
import { restockSchema } from "@/validation/stock";

/** POST: stock-in operation (ADMIN/DISPATCHER) with a movement log. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await requireSession(["ADMIN", "DISPATCHER"]);
    const { id } = await ctx.params;
    const input = restockSchema.parse(await parseJson(request));
    const part = await restockPart(session.user, id, input);
    return NextResponse.json(part);
  });
}

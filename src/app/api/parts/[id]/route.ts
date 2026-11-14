import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import { updatePart } from "@/server/services/stock";
import { partUpdateSchema } from "@/validation/stock";

/** PATCH: update catalogue metadata (ADMIN). Quantity changes use restock. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await requireSession(["ADMIN"]);
    const { id } = await ctx.params;
    const input = partUpdateSchema.parse(await parseJson(request));
    const part = await updatePart(session.user, id, input);
    return NextResponse.json(part);
  });
}

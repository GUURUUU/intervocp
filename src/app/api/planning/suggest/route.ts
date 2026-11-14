import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";
import { suggestQuerySchema } from "@/validation/intervention";
import { suggestTechnicians } from "@/server/services/planning";

/** GET /api/planning/suggest — ranked technicians with score breakdown. */
export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireSession(["ADMIN", "DISPATCHER"]);
    const url = new URL(request.url);
    const query = suggestQuerySchema.parse(Object.fromEntries(url.searchParams));

    const suggestions = await suggestTechnicians(
      query.interventionId,
      query.plannedStart,
      query.plannedEnd
    );
    return NextResponse.json({ suggestions });
  });
}

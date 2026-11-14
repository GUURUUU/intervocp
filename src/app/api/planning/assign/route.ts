import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import { assignSchema } from "@/validation/intervention";
import { assignTechnician } from "@/server/services/planning";

/** POST /api/planning/assign — manual assignment (double-booking safe). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession(["ADMIN", "DISPATCHER"]);
    const body = await parseJson(request);
    const input = assignSchema.parse(body);

    const updated = await assignTechnician(session.user, input);
    return NextResponse.json(updated, { status: 201 });
  });
}

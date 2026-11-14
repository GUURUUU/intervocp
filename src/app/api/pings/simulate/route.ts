import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";
import { simulatePings } from "@/server/services/tracking";

/**
 * POST: demo simulator — jitters every technician's position around the
 * OCP Khouribga site and records the pings (office roles only).
 */
export async function POST() {
  return handleRoute(async () => {
    const session = await requireSession(["ADMIN", "DISPATCHER", "MANAGER"]);
    const result = await simulatePings(session.user);
    return NextResponse.json(result, { status: 201 });
  });
}

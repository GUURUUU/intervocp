import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import { getLivePositions, recordPing } from "@/server/services/tracking";
import { z } from "zod";

const pingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** GET: live technician positions (role-aware). */
export async function GET() {
  return handleRoute(async () => {
    const session = await requireSession();
    const data = await getLivePositions(session.user);
    return NextResponse.json(data);
  });
}

/** POST: record the current user's GPS position ping. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = pingSchema.parse(await parseJson(request));
    await recordPing(session.user, body.latitude, body.longitude);
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}

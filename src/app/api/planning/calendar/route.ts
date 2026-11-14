import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";
import { calendarQuerySchema } from "@/validation/intervention";
import { getCalendar } from "@/server/services/planning";

/** GET /api/planning/calendar?start&end — assignments + unscheduled queue. */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession(["ADMIN", "DISPATCHER", "TECHNICIAN"]);
    const url = new URL(request.url);
    const query = calendarQuerySchema.parse(Object.fromEntries(url.searchParams));

    const data = await getCalendar(query.start, query.end);

    // Technicians only see their own assignments
    if (session.user.role === "TECHNICIAN") {
      data.assignments = data.assignments.filter(
        (a) => a.technician.id === session.user.id
      );
    }

    return NextResponse.json(data);
  });
}

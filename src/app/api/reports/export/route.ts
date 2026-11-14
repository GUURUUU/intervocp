import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";
import { buildInterventionsCsv } from "@/server/services/reports";

/** GET: CSV export of all interventions (office roles). */
export async function GET() {
  return handleRoute(async () => {
    const session = await requireSession(["ADMIN", "DISPATCHER", "MANAGER"]);
    const csv = await buildInterventionsCsv(session.user);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="interventions-${date}.csv"`,
      },
    });
  });
}

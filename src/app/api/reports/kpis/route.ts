import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";
import { getDashboardKpis } from "@/server/services/reports";

/** GET: role-scoped dashboard KPIs. */
export async function GET() {
  return handleRoute(async () => {
    const session = await requireSession();
    const kpis = await getDashboardKpis(session.user);
    return NextResponse.json(kpis);
  });
}

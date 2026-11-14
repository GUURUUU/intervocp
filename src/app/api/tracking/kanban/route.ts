import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";
import { getKanbanRequests } from "@/server/services/tracking";

/** GET: lightweight intervention list for the Kanban board. */
export async function GET() {
  return handleRoute(async () => {
    const session = await requireSession();
    const data = await getKanbanRequests(session.user);
    return NextResponse.json(data);
  });
}

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import { listQuerySchema, interventionCreateSchema } from "@/validation/intervention";
import { createRequest, listRequests } from "@/server/services/requests";

/** GET /api/requests — filtered, searchable, paginated list. */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession();
    const url = new URL(request.url);
    const query = listQuerySchema.parse(Object.fromEntries(url.searchParams));

    const result = await listRequests(session.user, query);
    return NextResponse.json(result);
  });
}

/** POST /api/requests — create a request (any authenticated role). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = interventionCreateSchema.parse(body);

    const created = await createRequest(session.user, input);
    return NextResponse.json(created, { status: 201 });
  });
}

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import {
  interventionUpdateSchema,
  statusChangeSchema,
  satisfactionSchema,
} from "@/validation/intervention";
import {
  changeStatus,
  deleteRequest,
  getRequest,
  rateIntervention,
  updateRequest,
} from "@/server/services/requests";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/requests/:id — full detail. */
export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const detail = await getRequest(session.user, id);
    return NextResponse.json(detail);
  });
}

/** PATCH /api/requests/:id — editable fields (role-checked in service). */
export async function PATCH(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await parseJson(request);
    const input = interventionUpdateSchema.parse(body);
    const updated = await updateRequest(session.user, id, input);
    return NextResponse.json(updated);
  });
}

/** PUT /api/requests/:id/status — status transition. */
export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await parseJson(request);
    const { toStatus, comment } = statusChangeSchema.parse(body);
    const updated = await changeStatus(session.user, id, toStatus, comment);
    return NextResponse.json(updated);
  });
}

/** POST /api/requests/:id/rating — client satisfaction rating. */
export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await parseJson(request);
    const { rating, comment } = satisfactionSchema.parse(body);
    const updated = await rateIntervention(session.user, id, rating, comment);
    return NextResponse.json(updated);
  });
}

/** DELETE /api/requests/:id — hard delete (ADMIN only). */
export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    await requireSession(["ADMIN"]);
    const { id } = await context.params;
    await deleteRequest(id);
    return NextResponse.json({ ok: true });
  });
}

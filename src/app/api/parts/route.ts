import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson } from "@/lib/api-helpers";
import { createPart, listParts } from "@/server/services/stock";
import { partSchema } from "@/validation/stock";

/** GET: parts catalogue (search + low-stock filter). */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession([
      "ADMIN",
      "DISPATCHER",
      "TECHNICIAN",
      "MANAGER",
    ]);
    const { searchParams } = new URL(request.url);
    const data = await listParts(session.user, {
      search: searchParams.get("search")?.trim() || undefined,
      lowOnly: searchParams.get("low") === "1",
    });
    return NextResponse.json(data);
  });
}

/** POST: create a catalogue entry (ADMIN). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession(["ADMIN"]);
    const input = partSchema.parse(await parseJson(request));
    const part = await createPart(session.user, input);
    return NextResponse.json(part, { status: 201 });
  });
}

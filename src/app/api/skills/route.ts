import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";

/** GET /api/skills — skills list (for dropdowns). */
export async function GET() {
  return handleRoute(async () => {
    await requireSession();
    const items = await prisma.skill.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(items);
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";

/** GET /api/equipment — equipment list (for dropdowns). */
export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireSession();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";

    const items = await prisma.equipment.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { location: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take: 100,
    });

    return NextResponse.json({ items });
  });
}

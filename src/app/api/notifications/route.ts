import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { jsonError, handleRoute } from "@/lib/api-helpers";

/** GET /api/notifications — the caller's notifications (latest 30). */
export async function GET() {
  return handleRoute(async () => {
    const session = await auth();
    if (!session?.user) return jsonError(401, "Non authentifié");

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  });
}

/** POST /api/notifications — mark some (or all) notifications as read. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await auth();
    if (!session?.user) return jsonError(401, "Non authentifié");

    const body = (await request.json().catch(() => ({}))) as {
      ids?: string[];
      all?: boolean;
    };

    if (body.all) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      });
    } else if (body.ids && body.ids.length > 0) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, id: { in: body.ids } },
        data: { read: true },
      });
    }

    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson, ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";
import { notifyUsers } from "@/lib/notifications";

const commentSchema = z.object({
  interventionId: z.string().cuid(),
  message: z.string().trim().min(1, "Message vide").max(2000),
});

/** POST /api/comments — add a comment to an intervention. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = commentSchema.parse(body);

    const intervention = await prisma.intervention.findUnique({
      where: { id: input.interventionId },
      include: { assignments: { select: { technicianId: true } } },
    });
    if (!intervention) throw new ApiError(404, "Intervention introuvable");

    const allowed =
      session.user.role === "ADMIN" ||
      session.user.role === "DISPATCHER" ||
      session.user.role === "MANAGER" ||
      intervention.requesterId === session.user.id ||
      intervention.assignments.some((a) => a.technicianId === session.user.id);
    if (!allowed) throw new ApiError(403, "Commentaire non autorisé");

    const comment = await prisma.comment.create({
      data: {
        interventionId: input.interventionId,
        authorId: session.user.id,
        message: input.message,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    // Notify stakeholders except the author
    const targets = new Set<string>([intervention.requesterId]);
    intervention.assignments.forEach((a) => targets.add(a.technicianId));
    targets.delete(session.user.id);

    await notifyUsers({
      userIds: Array.from(targets),
      message: `Nouveau commentaire sur ${intervention.reference}`,
    });

    publish("comment.created", {
      interventionId: input.interventionId,
      commentId: comment.id,
    });

    return NextResponse.json(comment, { status: 201 });
  });
}

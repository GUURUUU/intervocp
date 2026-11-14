import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, parseJson, ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";
import { notifyUsers } from "@/lib/notifications";

const incidentSchema = z.object({
  interventionId: z.string().cuid(),
  description: z.string().trim().min(5, "Description trop courte").max(2000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

/** POST /api/incidents — declare an incident on an intervention. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireSession();
    const body = await parseJson(request);
    const input = incidentSchema.parse(body);

    const intervention = await prisma.intervention.findUnique({
      where: { id: input.interventionId },
      include: { assignments: { select: { technicianId: true } } },
    });
    if (!intervention) throw new ApiError(404, "Intervention introuvable");

    // Technicians (assigned) and office roles can declare incidents
    const allowed =
      session.user.role === "ADMIN" ||
      session.user.role === "DISPATCHER" ||
      intervention.assignments.some((a) => a.technicianId === session.user.id);
    if (!allowed) throw new ApiError(403, "Signalement non autorisé");

    const incident = await prisma.incident.create({
      data: {
        interventionId: input.interventionId,
        description: input.description,
        severity: input.severity,
      },
    });

    // Notify requester + office
    const office = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "DISPATCHER"] }, active: true },
      select: { id: true },
    });
    await notifyUsers({
      userIds: Array.from(
        new Set([intervention.requesterId, ...office.map((u) => u.id)])
      ),
      message: `Incident signalé sur ${intervention.reference} (sévérité ${input.severity})`,
    });

    publish("incident.created", {
      interventionId: input.interventionId,
      incidentId: incident.id,
      severity: input.severity,
    });

    return NextResponse.json(incident, { status: 201 });
  });
}

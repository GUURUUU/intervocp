import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { handleRoute, ApiError } from "@/lib/api-helpers";

export const runtime = "nodejs";

/** GET /api/attachments/:id/file — streams the stored file (authorized). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "Non authentifié");

    const { id } = await context.params;
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        intervention: {
          include: { assignments: { select: { technicianId: true } } },
        },
      },
    });
    if (!attachment) throw new ApiError(404, "Pièce jointe introuvable");

    const allowed =
      session.user.role === "ADMIN" ||
      session.user.role === "DISPATCHER" ||
      session.user.role === "MANAGER" ||
      attachment.intervention.requesterId === session.user.id ||
      attachment.intervention.assignments.some(
        (a) => a.technicianId === session.user.id
      );
    if (!allowed) throw new ApiError(403, "Accès refusé");

    // Path traversal protection: only the bare stored name is used.
    const storedName = path.basename(attachment.filePath);
    const filePath = path.join(process.cwd(), "uploads", storedName);

    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) throw new ApiError(404, "Fichier introuvable sur le disque");

    const buffer = await fs.readFile(filePath);
    const mimeByExt: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".pdf": "application/pdf",
      ".txt": "text/plain",
    };
    const mime =
      mimeByExt[path.extname(storedName).toLowerCase()] ??
      (attachment.kind === "PHOTO" ? "image/jpeg" : "application/octet-stream");

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}

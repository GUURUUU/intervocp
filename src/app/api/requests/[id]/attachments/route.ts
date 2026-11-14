import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute, ApiError } from "@/lib/api-helpers";
import { publish } from "@/lib/events";

export const runtime = "nodejs";

/** Directory where uploaded files are stored (git-ignored). */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];

/** POST /api/requests/:id/attachments — multipart upload (photo/document). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await context.params;

    const intervention = await prisma.intervention.findUnique({ where: { id } });
    if (!intervention) throw new ApiError(404, "Intervention introuvable");

    // Only the requester (own), technician assigned, or office can upload
    const allowed =
      session.user.role === "ADMIN" ||
      session.user.role === "DISPATCHER" ||
      intervention.requesterId === session.user.id ||
      (await prisma.assignment.findFirst({
        where: { interventionId: id, technicianId: session.user.id },
      })) !== null;
    if (!allowed) throw new ApiError(403, "Upload non autorisé");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Fichier manquant");
    if (file.size > MAX_FILE_SIZE) throw new ApiError(413, "Fichier trop volumineux (max 10 Mo)");
    if (!ALLOWED_MIME.includes(file.type)) {
      throw new ApiError(415, "Type de fichier non autorisé");
    }

    const kind = file.type.startsWith("image/") ? "PHOTO" : "DOCUMENT";

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = path.extname(file.name).slice(0, 10) || "";
    const storedName = `${safeName}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer);

    const attachment = await prisma.attachment.create({
      data: {
        interventionId: id,
        uploadedBy: session.user.id,
        filePath: storedName,
        fileName: file.name,
        kind,
      },
    });

    publish("intervention.updated", { id, attachmentAdded: true });
    return NextResponse.json(attachment, { status: 201 });
  });
}

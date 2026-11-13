import { NextResponse } from "next/server";
import type { SseEvent } from "@/lib/events";
import { subscribe } from "@/lib/events";
import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events endpoint.
 * Delivers live status changes, notifications, pings, etc.
 * Events are filtered per user: only events targeted at the caller
 * (or broadcast to their role) are forwarded.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return jsonError(401, "Non authentifié");
    }

    const userId = session.user.id;
    const role = session.user.role;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (event: SseEvent) => {
          // Role/user targeting filter
          if (
            event.targetUserIds &&
            event.targetUserIds.length > 0 &&
            !event.targetUserIds.includes(userId)
          ) {
            return;
          }
          if (
            event.targetRoles &&
            event.targetRoles.length > 0 &&
            !event.targetRoles.includes(role)
          ) {
            return;
          }
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Stream closed
          }
        };

        const unsubscribe = subscribe(send);

        // Initial hello + heartbeat every 25s
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "heartbeat", payload: "connected", timestamp: Date.now() })}\n\n`
          )
        );
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "heartbeat", payload: "ping", timestamp: Date.now() })}\n\n`
              )
            );
          } catch {
            clearInterval(heartbeat);
          }
        }, 25000);

        // Cleanup on client disconnect
        (controller as unknown as { __cleanup?: () => void }).__cleanup = () => {
          unsubscribe();
          clearInterval(heartbeat);
        };
      },
      cancel(reason) {
        const cleanup = (this as unknown as { __cleanup?: () => void }).__cleanup;
        cleanup?.();
        console.info("[sse] client disconnected", reason);
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[sse] stream error:", error);
    return jsonError(500, "Erreur du flux temps réel");
  }
}

import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/events";

interface NotifyOptions {
  /** Recipient user ids. */
  userIds: string[];
  message: string;
  /** Extra targeting for SSE delivery (defaults to userIds). */
  broadcastAll?: boolean;
}

/**
 * Persists in-app notifications and pushes them through the SSE bus.
 */
export async function notifyUsers({
  userIds,
  message,
  broadcastAll = false,
}: NotifyOptions): Promise<void> {
  if (userIds.length > 0) {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, message })),
    });
  }

  publish(
    "notification",
    { message, userIds },
    broadcastAll ? undefined : { targetUserIds: userIds }
  );
}

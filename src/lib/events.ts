/**
 * In-process pub/sub event bus used by Server-Sent Events (SSE).
 * Single-process development/demo scope: a single Node process publishes
 * and the `/api/stream` route fans out to connected clients.
 */

export type SseEventType =
  | "notification"
  | "intervention.status"
  | "intervention.created"
  | "intervention.updated"
  | "intervention.assigned"
  | "comment.created"
  | "incident.created"
  | "location.ping"
  | "stock.low"
  | "heartbeat";

export interface SseEvent {
  type: SseEventType;
  payload: unknown;
  timestamp: number;
  /** Optional targeting: user ids or roles allowed to receive the event. */
  targetUserIds?: string[];
  targetRoles?: string[];
}

type Listener = (event: SseEvent) => void;

const globalForBus = globalThis as unknown as {
  __intervocpListeners?: Set<Listener>;
};

const listeners: Set<Listener> = (globalForBus.__intervocpListeners ??=
  new Set<Listener>());

/** Publish an event to all connected SSE clients (server-side only). */
export function publish(
  type: SseEventType,
  payload: unknown,
  targeting?: { targetUserIds?: string[]; targetRoles?: string[] }
): void {
  const event: SseEvent = {
    type,
    payload,
    timestamp: Date.now(),
    ...targeting,
  };
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Never let one broken listener break others.
    }
  }
}

/** Subscribe a listener; returns the unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

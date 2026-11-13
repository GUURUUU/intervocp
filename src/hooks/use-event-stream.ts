"use client";

import { useEffect, useRef } from "react";
import type { SseEvent } from "@/lib/events";

/**
 * Subscribes to the server event stream (`/api/stream`).
 * The handler is kept in a ref so it can change without resubscribing.
 */
export function useEventStream(handler: (event: SseEvent) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as SseEvent;
        handlerRef.current(event);
      } catch {
        // Ignore malformed events
      }
    };

    source.onerror = () => {
      // The browser retries automatically.
    };

    return () => {
      source.close();
    };
  }, []);
}

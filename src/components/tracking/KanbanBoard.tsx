"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Role, Status } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { useEventStream } from "@/hooks/use-event-stream";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/format";
import { STATUS_TRANSITIONS } from "@/lib/status";

interface KanbanItem {
  id: string;
  reference: string;
  title: string;
  status: Status;
  priority: string;
  requester: { name: string };
  assignments: { technician: { id: string; name: string } }[];
  plannedStart: string | null;
}

const KANBAN_COLUMNS: Status[] = [
  "NOUVELLE",
  "PLANIFIEE",
  "EN_COURS",
  "EN_ATTENTE_PIECES",
  "TERMINEE",
  "CLOTUREE",
];

const COLUMN_ACCENT: Record<Status, string> = {
  NOUVELLE: "border-t-sky-400",
  PLANIFIEE: "border-t-amber-400",
  EN_COURS: "border-t-emerald-500",
  EN_ATTENTE_PIECES: "border-t-orange-400",
  TERMINEE: "border-t-indigo-400",
  CLOTUREE: "border-t-emerald-600",
  ANNULEE: "border-t-rose-400",
};

/** Allowed next statuses for the current user (server enforces again). */
function allowedTransitions(status: Status, role: Role): Status[] {
  const base = (STATUS_TRANSITIONS[status] ?? []) as Status[];
  if (role === "ADMIN" || role === "DISPATCHER") return base;
  if (role === "TECHNICIAN") {
    return base.filter((s) =>
      ["EN_COURS", "EN_ATTENTE_PIECES", "TERMINEE"].includes(s)
    );
  }
  if (role === "CLIENT") return base.filter((s) => s === "ANNULEE");
  return [];
}

/**
 * Kanban board by status with glass cards and HTML5 drag & drop
 * (role-aware transitions). Live refresh through SSE.
 */
export default function KanbanBoard({ role }: { role: Role }) {
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tracking/kanban", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { items: KanbanItem[] };
        setItems(data.items);
      }
    } catch {
      // offline — keep current board
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEventStream(
    useCallback(
      (event) => {
        if (event.type.startsWith("intervention.")) void load();
      },
      [load]
    )
  );

  const moveCard = useCallback(
    async (id: string, toStatus: Status) => {
      setError(null);
      const res = await fetch(`/api/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus }),
      });
      if (res.ok) {
        await load();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Transition refusée");
        await load();
      }
    },
    [load]
  );

  const onDrop = (target: Status) => (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(null);
    const raw = event.dataTransfer.getData("text/intervocp-card");
    if (!raw) return;
    const { id, from } = JSON.parse(raw) as { id: string; from: Status };
    if (from === target) return;
    if (!allowedTransitions(from, role).includes(target)) {
      setError("Transition non autorisée pour votre rôle");
      return;
    }
    void moveCard(id, target);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Tableau Kanban ({items.length})
        </p>
        <p className="text-xs text-muted-foreground">
          Glissez-déposez une carte pour changer son statut
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
      <div className="grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map((status) => {
          const columnItems = items.filter((i) => i.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((c) => (c === status ? null : c))}
              onDrop={onDrop(status)}
              className={`glass-panel min-h-64 rounded-xl border-t-4 ${COLUMN_ACCENT[status]} p-2 transition ${
                dragOver === status ? "ring-2 ring-emerald-500/50" : ""
              }`}
            >
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[status]} ({columnItems.length})
              </p>
              <ul className="space-y-2">
                {columnItems.map((item) => (
                  <li
                    key={item.id}
                    draggable={
                      allowedTransitions(item.status, role).length > 0
                    }
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "text/intervocp-card",
                        JSON.stringify({ id: item.id, from: item.status })
                      );
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <Link
                      href={`/requests/${item.id}`}
                      className="glass-panel-soft block rounded-lg p-2.5 transition hover:scale-[1.01]"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] text-emerald-700">
                          {item.reference}
                        </span>
                        <Badge
                          variant="outline"
                          className={`px-1 py-0 text-[10px] ${PRIORITY_BADGE_CLASS[item.priority as keyof typeof PRIORITY_BADGE_CLASS]}`}
                        >
                          {PRIORITY_LABELS[item.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
                        {item.title}
                      </p>
                      {item.assignments.length > 0 ? (
                        <p className="mt-1 truncate text-[10px] text-muted-foreground">
                          {item.assignments
                            .map((a) => a.technician.name)
                            .join(", ")}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

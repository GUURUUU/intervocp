"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Priority, Status } from "@prisma/client";
import { ArrowRight, Clock3 } from "lucide-react";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  formatDateTime,
} from "@/lib/format";
import { useEventStream } from "@/hooks/use-event-stream";

interface TrackingItem {
  id: string;
  reference: string;
  title: string;
  status: Status;
  priority: Priority;
  requester: { name: string };
  assignments: { technician: { id: string; name: string } }[];
  createdAt: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  closedAt: string | null;
}

const STEPS = [
  { key: "createdAt", label: "Demande" },
  { key: "plannedStart", label: "Planifiée" },
  { key: "actualStart", label: "En cours" },
  { key: "actualEnd", label: "Terminée" },
  { key: "closedAt", label: "Clôturée" },
] as const;

const STATUS_STEP: Record<Status, number> = {
  NOUVELLE: 0,
  PLANIFIEE: 1,
  EN_COURS: 2,
  EN_ATTENTE_PIECES: 2,
  TERMINEE: 3,
  CLOTUREE: 4,
  ANNULEE: 0,
};

type Filter = "all" | "todo" | "active" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "todo", label: "À planifier" },
  { key: "active", label: "En cours" },
  { key: "done", label: "Terminées" },
];

/** "il y a 3 h" / "il y a 2 j" from an ISO date. */
function sinceLabel(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `depuis ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `depuis ${hours} h`;
  return `depuis ${Math.floor(hours / 24)} j`;
}

function StepRail({ item }: { item: TrackingItem }) {
  const current = STATUS_STEP[item.status];
  const cancelled = item.status === "ANNULEE";

  return (
    <ol className="mt-3 hidden grid-cols-5 gap-1 sm:grid" aria-label="Étapes du suivi">
      {STEPS.map((step, index) => {
        const done = !cancelled && index <= current;
        const isCurrent = !cancelled && index === current;
        const value = item[step.key];
        return (
          <li key={step.key} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-1.5 flex-1 rounded-full ${
                  done ? "bg-[#1a4a7a]" : "bg-[#e2e8f0]"
                }`}
              />
            </div>
            <p
              className={`mt-1.5 truncate text-[11px] ${
                isCurrent
                  ? "font-semibold text-[#0b2a4a]"
                  : done
                    ? "font-medium text-foreground/75"
                    : "text-muted-foreground/70"
              }`}
            >
              {step.label}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {value ? formatDateTime(value) : "—"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Intervention status tracking: where each request sits in the workflow,
 * with stage timestamps, owner and time in the current stage. Live via SSE.
 */
export default function TrackingFlow() {
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tracking/kanban", { cache: "no-store" });
      if (!res.ok) throw new Error("http");
      const data = (await res.json()) as { items: TrackingItem[] };
      setItems(data.items);
      setError(null);
    } catch {
      setError("Impossible de charger le suivi des interventions.");
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

  const counts = useMemo(
    () => ({
      planifier: items.filter((i) => i.status === "NOUVELLE").length,
      planifiees: items.filter((i) => i.status === "PLANIFIEE").length,
      enCours: items.filter(
        (i) => i.status === "EN_COURS" || i.status === "EN_ATTENTE_PIECES"
      ).length,
      terminees: items.filter((i) => i.status === "TERMINEE").length,
      cloturees: items.filter((i) => i.status === "CLOTUREE").length,
    }),
    [items]
  );

  const visible = useMemo(() => {
    if (filter === "todo") return items.filter((i) => i.status === "NOUVELLE");
    if (filter === "active") {
      return items.filter(
        (i) => i.status === "EN_COURS" || i.status === "EN_ATTENTE_PIECES"
      );
    }
    if (filter === "done") {
      return items.filter(
        (i) => i.status === "TERMINEE" || i.status === "CLOTUREE"
      );
    }
    return items;
  }, [items, filter]);

  const stats = [
    { label: "À planifier", value: counts.planifier, tone: "text-sky-700" },
    { label: "Planifiées", value: counts.planifiees, tone: "text-amber-700" },
    { label: "En cours", value: counts.enCours, tone: "text-emerald-700" },
    { label: "À clôturer", value: counts.terminees, tone: "text-indigo-700" },
    { label: "Clôturées", value: counts.cloturees, tone: "text-slate-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-panel rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            <p className={`mt-0.5 text-xl font-semibold tabular-nums ${stat.tone}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrer le suivi">
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={filter === entry.key}
              onClick={() => setFilter(entry.key)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === entry.key
                  ? "border-[#0b2a4a] bg-[#0b2a4a] text-white"
                  : "border-border bg-white text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {visible.length} intervention(s) · mise à jour automatique
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      {visible.length === 0 && !error ? (
        <p className="glass-panel rounded-xl px-4 py-10 text-center text-sm text-muted-foreground">
          Aucune intervention dans cette vue.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const technician = item.assignments[0]?.technician.name;
            const open =
              item.status !== "CLOTUREE" && item.status !== "ANNULEE";
            return (
              <li key={item.id} className="console-row p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-[#1a4a7a]">
                        {item.reference}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE_CLASS[item.priority]}`}
                      >
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    </div>
                    <Link
                      href={`/requests/${item.id}`}
                      className="mt-1 block truncate text-sm font-medium text-foreground hover:text-[#1a4a7a] hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {item.requester.name}
                      {technician ? ` · ${technician}` : " · non affectée"}
                      {open ? ` · ${sinceLabel(item.actualStart ?? item.createdAt)}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {open ? (
                      <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {item.status === "EN_ATTENTE_PIECES"
                          ? "pièces"
                          : STATUS_LABELS[item.status]}
                      </span>
                    ) : null}
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                    <Link
                      href={`/requests/${item.id}`}
                      aria-label={`Ouvrir ${item.reference}`}
                      className="text-muted-foreground hover:text-[#1a4a7a]"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                <StepRail item={item} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Sparkles,
} from "lucide-react";
import type { Status, Priority, InterventionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import SuggestDialog from "@/components/planning/SuggestDialog";
import { useEventStream } from "@/hooks/use-event-stream";
import {
  STATUS_BADGE_CLASS,
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
} from "@/lib/format";

interface CalendarAssignment {
  id: string;
  technician: { id: string; name: string };
  intervention: {
    id: string;
    reference: string;
    title: string;
    status: Status;
    priority: Priority;
    type: InterventionType;
    plannedStart: string;
    plannedEnd: string;
    locationText: string | null;
    equipment: { name: string } | null;
  };
}

interface UnscheduledItem {
  id: string;
  reference: string;
  title: string;
  priority: Priority;
  type: InterventionType;
  createdAt: string;
  requiredSkill: { name: string } | null;
}

interface CalendarData {
  assignments: CalendarAssignment[];
  unscheduled: UnscheduledItem[];
  technicians: { id: string; name: string }[];
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Week-planning board: technician rows × day columns + unscheduled queue. */
export default function PlanningBoard({ role }: { role: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestFor, setSuggestFor] = useState<UnscheduledItem | null>(null);
  const [suggestSlot, setSuggestSlot] = useState<{ start: Date; end: Date } | null>(null);

  const weekEnd = useMemo(() => {
    const end = addDays(weekStart, 7);
    end.setMilliseconds(-1);
    return end;
  }, [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      });
      const res = await fetch(`/api/planning/calendar?${params}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live refresh through SSE (assignments and status changes).
  useEventStream(
    useCallback(
      (event) => {
        if (event.type.startsWith("intervention.")) void load();
      },
      [load]
    )
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Group assignments per technician/day
  const cells = useMemo(() => {
    const map = new Map<string, CalendarAssignment[]>();
    if (!data) return map;
    for (const a of data.assignments) {
      const start = new Date(a.intervention.plannedStart);
      const dayIndex = Math.floor(
        (startOfDay(start).getTime() - startOfDay(weekStart).getTime()) / 86400000
      );
      if (dayIndex < 0 || dayIndex > 6) continue;
      const key = `${a.technician.id}|${dayIndex}`;
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [data, weekStart]);

  const openSuggest = (item: UnscheduledItem) => {
    // Default slot: next working day 8:00–10:00
    const start = new Date();
    start.setDate(start.getDate() + 1);
    if (start.getDay() === 6) start.setDate(start.getDate() + 2);
    if (start.getDay() === 0) start.setDate(start.getDate() + 1);
    start.setHours(8, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    setSuggestSlot({ start, end });
    setSuggestFor(item);
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Aujourd&rsquo;hui
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            aria-label="Semaine suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm font-medium text-foreground/80">
          Semaine du {weekStart.toLocaleDateString("fr-FR")} au{" "}
          {addDays(weekStart, 6).toLocaleDateString("fr-FR")}
        </p>
      </div>

      {/* Calendar grid */}
      <div className="glass-panel overflow-x-auto rounded-xl p-4">
        {loading ? (
          <div className="h-96 animate-pulse rounded-lg" />
        ) : (
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-36 border-b border-border pb-2 text-left text-muted-foreground">
                  Technicien
                </th>
                {days.map((day, i) => (
                  <th key={i} className="border-b border-border pb-2 text-center text-foreground/80">
                    <div>{DAY_LABELS[i]}</div>
                    <div className="text-xs font-normal text-muted-foreground/70">
                      {day.getDate()}/{day.getMonth() + 1}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.technicians ?? []).map((tech) => (
                <tr key={tech.id} className="border-b border-border/50">
                  <td className="py-2 pr-2 align-top">
                    <div className="glass-panel-soft rounded-lg px-2 py-1.5 text-xs font-medium text-foreground">
                      {tech.name}
                    </div>
                  </td>
                  {days.map((_, dayIndex) => {
                    const items = cells.get(`${tech.id}|${dayIndex}`) ?? [];
                    return (
                      <td key={dayIndex} className="w-[130px] p-1 align-top">
                        <div className="min-h-16 space-y-1">
                          {items.map((a) => {
                            const s = new Date(a.intervention.plannedStart);
                            const e = new Date(a.intervention.plannedEnd);
                            return (
                              <a
                                key={a.id}
                                href={`/requests/${a.intervention.id}`}
                                className={`block rounded-lg border px-2 py-1.5 text-[11px] transition hover:brightness-125 ${
                                  STATUS_BADGE_CLASS[a.intervention.status]
                                }`}
                              >
                                <span className="block truncate font-semibold">
                                  {a.intervention.reference}
                                </span>
                                <span className="block truncate opacity-80">
                                  {String(s.getHours()).padStart(2, "0")}:
                                  {String(s.getMinutes()).padStart(2, "0")}–
                                  {String(e.getHours()).padStart(2, "0")}:
                                  {String(e.getMinutes()).padStart(2, "0")}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Unscheduled queue (office roles) */}
      {role === "ADMIN" || role === "DISPATCHER" ? (
        <div className="glass-panel rounded-xl p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Inbox className="h-4 w-4 text-emerald-600" />
            Demandes à planifier ({data?.unscheduled.length ?? 0})
          </p>
          {!data || data.unscheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande en attente de planification.
            </p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {data.unscheduled.map((item) => (
                <li key={item.id} className="glass-panel-soft rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-emerald-700">{item.reference}</span>
                    <span className={`rounded border px-1.5 text-[10px] ${PRIORITY_BADGE_CLASS[item.priority]}`}>
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-foreground">{item.title}</p>
                  {item.requiredSkill ? (
                    <p className="text-[11px] text-muted-foreground">
                      Compétence : {item.requiredSkill.name}
                    </p>
                  ) : null}
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => openSuggest(item)}
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Suggérer & affecter
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {suggestFor && suggestSlot ? (
        <SuggestDialog
          open={Boolean(suggestFor)}
          onOpenChange={(open) => {
            if (!open) {
              setSuggestFor(null);
              setSuggestSlot(null);
            }
          }}
          interventionId={suggestFor.id}
          interventionReference={suggestFor.reference}
          plannedStart={suggestSlot.start}
          plannedEnd={suggestSlot.end}
          onAssigned={load}
        />
      ) : null}
    </div>
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

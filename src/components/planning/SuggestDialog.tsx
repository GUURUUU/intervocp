"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, UserPlus } from "lucide-react";
import type { Suggestion } from "@/server/services/planning";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import LiquidGlassCard from "@/components/glass/LiquidGlassCard";

interface SuggestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interventionId: string;
  interventionReference?: string;
  /** Current planned slot (pre-filled, editable). */
  plannedStart: Date;
  plannedEnd: Date;
  onAssigned?: () => void;
}

/**
 * "Suggest Technician" modal — shows the ranked list with the full
 * scoring breakdown so the Dispatcher understands each ranking.
 */
export default function SuggestDialog({
  open,
  onOpenChange,
  interventionId,
  interventionReference,
  plannedStart,
  plannedEnd,
  onAssigned,
}: SuggestDialogProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (open) {
      setStart(toLocalInput(plannedStart));
      setEnd(toLocalInput(plannedEnd));
      setSuggestions(null);
      setError(null);
    }
  }, [open, plannedStart, plannedEnd]);

  const compute = useCallback(async () => {
    if (!start || !end) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        interventionId,
        plannedStart: new Date(start).toISOString(),
        plannedEnd: new Date(end).toISOString(),
      });
      const res = await fetch(`/api/planning/suggest?${params}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Erreur de calcul des suggestions");
      }
    } finally {
      setLoading(false);
    }
  }, [interventionId, start, end]);

  useEffect(() => {
    if (open && start && end && !suggestions && !loading) void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const assign = async (technicianId: string) => {
    setAssigning(technicianId);
    setError(null);
    try {
      const res = await fetch("/api/planning/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interventionId,
          technicianId,
          plannedStart: new Date(start).toISOString(),
          plannedEnd: new Date(end).toISOString(),
        }),
      });
      if (res.ok) {
        onOpenChange(false);
        onAssigned?.();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Affectation impossible");
      }
    } finally {
      setAssigning(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-border bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            Suggestion de technicien
            {interventionReference ? (
              <span className="font-mono text-sm text-emerald-700">{interventionReference}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Classement selon : compétences (40 %), disponibilité (25 %), charge (20 %),
            distance (15 %).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 px-1">
          <div className="space-y-1">
            <Label htmlFor="slot-start" className="text-xs">Début</Label>
            <input
              id="slot-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-foreground/5 px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slot-end" className="text-xs">Fin</Label>
            <input
              id="slot-end"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-foreground/5 px-2 text-sm"
            />
          </div>
        </div>

        <Button onClick={() => void compute()} disabled={loading} size="sm" className="mx-1 w-fit">
          {loading ? "Calcul…" : "Recalculer"}
        </Button>

        {error ? <p role="alert" className="px-1 text-sm text-rose-600">{error}</p> : null}

        <ScrollArea className="max-h-[50vh] px-1">
          {!suggestions ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s, index) => (
                <li key={s.technicianId}>
                  <LiquidGlassCard
                    borderRadius={16}
                    tintOpacity={s.ineligible ? 0.35 : 0.15}
                    className="p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="flex items-center gap-2 font-semibold text-foreground">
                          <span className="text-emerald-700">#{index + 1}</span>
                          {s.name}
                          {s.ineligible ? (
                            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] uppercase text-rose-700">
                              Indisponible
                            </span>
                          ) : null}
                        </p>

                        {/* Score breakdown bars */}
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <ScoreBar label="Compétences" value={s.breakdown.skillMatch} />
                          <ScoreBar label="Disponibilité" value={s.breakdown.availability} />
                          <ScoreBar label="Charge" value={s.breakdown.workload} />
                          <ScoreBar label="Distance" value={s.breakdown.distance} />
                        </div>

                        <ul className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                          {s.reasons.map((r, i) => (
                            <li key={i} className="rounded bg-foreground/5 px-1.5 py-0.5">{r}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-lg bg-emerald-500/10 px-2 py-1 font-mono text-sm text-emerald-700">
                          {(s.totalScore * 100).toFixed(0)}
                        </span>
                        <Button
                          size="sm"
                          disabled={s.ineligible || assigning !== null}
                          onClick={() => void assign(s.technicianId)}
                        >
                          <UserPlus className="mr-1 h-3 w-3" />
                          {assigning === s.technicianId ? "…" : "Affecter"}
                        </Button>
                      </div>
                    </div>
                  </LiquidGlassCard>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">
        {(value * 100).toFixed(0)}
      </span>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  Clock3,
  Download,
  Star,
  TimerOff,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  InterventionType,
  Priority,
  Status,
} from "@prisma/client";
import type { DashboardKpis } from "@/server/services/reports";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatMad,
} from "@/lib/format";
import { useEventStream } from "@/hooks/use-event-stream";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  NOUVELLE: "#0ea5e9",
  PLANIFIEE: "#f59e0b",
  EN_COURS: "#10b981",
  EN_ATTENTE_PIECES: "#fb923c",
  TERMINEE: "#6366f1",
  CLOTUREE: "#059669",
  ANNULEE: "#f43f5e",
};

const TYPE_COLORS: Record<string, string> = {
  CORRECTIVE: "#10b981",
  PREVENTIVE: "#0ea5e9",
  URGENT: "#f43f5e",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#f43f5e",
};

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(255, 255, 255, 0.92)",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 12,
  fontSize: 12,
  color: "#0f172a",
} as const;

const TICK = { fontSize: 10, fill: "#64748b" } as const;

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0b2a4a]/8 text-[#0b2a4a]">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="text-[11px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

export default function KpiBoard({ canExport = false }: { canExport?: boolean }) {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports/kpis");
      if (!res.ok) throw new Error("http");
      setKpis((await res.json()) as DashboardKpis);
      setError(null);
    } catch {
      setError("Impossible de charger les indicateurs.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEventStream((event) => {
    if (event.type === "intervention.status" || event.type === "intervention.assigned") {
      void load();
    }
  });

  if (error) {
    return <p role="alert" className="text-sm text-rose-600">{error}</p>;
  }

  if (!kpis) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border bg-foreground/5"
          />
        ))}
      </div>
    );
  }

  const statusData = kpis.byStatus.map((s) => ({
    name: STATUS_LABELS[s.key as Status] ?? s.key,
    count: s.count,
    fill: STATUS_COLORS[s.key] ?? "#64748b",
  }));

  const typeData = kpis.byType.map((t) => ({
    name: TYPE_LABELS[t.key as InterventionType] ?? t.key,
    value: t.count,
    fill: TYPE_COLORS[t.key] ?? "#64748b",
  }));

  const priorityData = kpis.byPriority.map((p) => ({
    name: PRIORITY_LABELS[p.key as Priority] ?? p.key,
    count: p.count,
    fill: PRIORITY_COLORS[p.key] ?? "#64748b",
  }));

  const total = kpis.total || 1;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Demandes suivies"
          value={String(kpis.total)}
        />
        <StatCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Résolution moyenne"
          value={
            kpis.avgResolutionHours === null
              ? "—"
              : `${kpis.avgResolutionHours.toFixed(1)} h`
          }
        />
        <StatCard
          icon={<TimerOff className="h-4 w-4" />}
          label="Taux de retard"
          value={
            kpis.delayRate === null
              ? "—"
              : `${Math.round(kpis.delayRate * 100)} %`
          }
          hint={`${kpis.delayedCount} / ${kpis.completedCount} clôturées en retard`}
        />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="Satisfaction"
          value={
            kpis.avgSatisfaction === null
              ? "—"
              : `${kpis.avgSatisfaction.toFixed(1)} / 5`
          }
          hint={`${kpis.ratingCount} évaluation(s)`}
        />
        <StatCard
          icon={<Banknote className="h-4 w-4" />}
          label="Pièces ce mois"
          value={formatMad(kpis.partsCostMonth)}
          hint={`${kpis.partsUnitsMonth} unité(s) consommée(s)`}
        />
      </div>

      {/* Toolbar (reports page) */}
      {canExport ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="secondary">
            <a href="/api/reports/export" download="interventions.csv">
              <Download className="mr-1 h-4 w-4" /> Exporter en CSV
            </a>
          </Button>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Répartition par statut">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={TICK}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={64}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={TICK} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
              <Bar dataKey="count" name="Demandes" radius={[6, 6, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume mensuel (6 derniers mois)">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={kpis.monthlyVolume} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
              <defs>
                <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" vertical={false} />
              <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="count"
                name="Demandes"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#volumeFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Types d'intervention">
          {typeData.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Aucune donnée.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {typeData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-2 text-sm">
                {typeData.map((entry) => (
                  <li key={entry.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-foreground/80">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      {entry.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.value} ({Math.round((entry.value / total) * 100)} %)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Répartition par priorité">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={priorityData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
              <Bar dataKey="count" name="Demandes" radius={[6, 6, 0, 0]}>
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Technician utilization */}
      {kpis.technicianUtilization.length > 0 ? (
        <div className="glass-panel rounded-xl p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Charge des techniciens
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.technicianUtilization.slice(0, 9).map((t) => (
              <li
                key={t.id}
                className="glass-panel-soft flex items-center justify-between rounded-lg px-3 py-2"
              >
                <span className="truncate text-sm text-foreground/90">{t.name}</span>
                <span className="flex shrink-0 gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
                    {t.active} en cours
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                    {t.completed} finies
                  </span>
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5">
                    {Math.round(t.hours)} h
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

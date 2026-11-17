import { ActionLink, Empty, Panel, StatTile, Stars, Tag } from "@/components/dashboard/parts";
import KpiBoard from "@/components/reports/KpiBoard";
import { formatDate } from "@/lib/format";
import type { ManagerDashboard as ManagerData } from "@/server/services/dashboard";

export default function ManagerDashboard({
  data,
  userName,
}: {
  data: ManagerData;
  userName: string;
}) {
  const maxWeekly = Math.max(
    1,
    ...data.weekly.map((w) => Math.max(w.opened, w.closed))
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Pilotage du service</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(new Date())} · Performance, qualité de service et charge de
            l&rsquo;équipe — <span className="font-medium text-foreground">{userName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionLink href="/reports" label="Rapports détaillés" />
          <ActionLink href="/tracking" label="Suivi en direct" primary />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatTile
          label="Backlog > 7 j"
          value={data.backlog7}
          hint="Demandes ouvertes anciennes"
          tone={data.backlog7 > 0 ? "warning" : "good"}
        />
        <StatTile
          label="Backlog > 30 j"
          value={data.backlog30}
          tone={data.backlog30 > 0 ? "danger" : "good"}
        />
        <StatTile label="Clôturées (7 j)" value={data.closedWeek} tone="good" />
        <StatTile label="Clôturées ce mois" value={data.closedMonth} />
        <StatTile
          label="Part de préventif"
          value={`${data.preventiveShare} %`}
          hint={`${data.openCount} demande(s) ouverte(s)`}
        />
        <StatTile
          label="Satisfaction"
          value={data.satisfaction === null ? "—" : `${data.satisfaction} / 5`}
        />
      </div>

      <KpiBoard canExport />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Performance de l'équipe"
          hint="Interventions terminées par technicien"
          href="/reports"
        >
          {data.team.length === 0 ? (
            <Empty>Aucun technicien actif.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.team.map((tech) => (
                <li
                  key={tech.id}
                  className="console-row flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                    {tech.name}
                  </span>
                  <Tag tone="info">{tech.active} en cours</Tag>
                  <Tag tone="good">{tech.completed} terminées</Tag>
                  <Tag tone={tech.delayed > 0 ? "warn" : "neutral"}>{tech.delayed} en retard</Tag>
                  <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                    {tech.hours} h
                  </span>
                  <Stars rating={tech.satisfaction} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Volume hebdomadaire" hint="Ouvertes vs clôturées (6 semaines)">
          <div className="flex items-end justify-between gap-3 px-2 pb-2 pt-4">
            {data.weekly.map((week) => (
              <div key={week.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-full items-end justify-center gap-1">
                  <div
                    className="w-2.5 rounded-t bg-[#1a4a7a]"
                    style={{ height: `${Math.round((week.opened / maxWeekly) * 100)}%` }}
                    title={`${week.opened} ouverte(s)`}
                  />
                  <div
                    className="w-2.5 rounded-t bg-emerald-500"
                    style={{ height: `${Math.round((week.closed / maxWeekly) * 100)}%` }}
                    title={`${week.closed} clôturée(s)`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{week.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 border-t border-border pt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-[#1a4a7a]" /> Ouvertes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Clôturées
            </span>
          </div>
        </Panel>
      </div>

      <Panel title="Retours clients" hint="Derniers commentaires de satisfaction">
        {data.feedback.length === 0 ? (
          <Empty>Aucun commentaire de satisfaction.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.feedback.map((entry) => (
              <li key={entry.id} className="glass-panel-soft rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground/90">
                    {entry.reference}
                  </span>
                  <Tag tone={(entry.rating ?? 0) >= 4 ? "good" : "warn"}>
                    {entry.rating ?? "—"} / 5
                  </Tag>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] italic text-muted-foreground">
                  « {entry.comment} »
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

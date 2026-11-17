import Link from "next/link";
import { ActionLink, Empty, ItemList, KeyRow, Panel, StatTile, Tag } from "@/components/dashboard/parts";
import { formatDate, formatDateTime, formatMad } from "@/lib/format";
import type { TechnicianDashboard as TechnicianData } from "@/server/services/dashboard";

export default function TechnicianDashboard({
  data,
  userName,
}: {
  data: TechnicianData;
  userName: string;
}) {
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Ma journée</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(new Date())} · Vos interventions, vos pièces et vos
            compétences — <span className="font-medium text-foreground">{userName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionLink href="/requests" label="Mes demandes" />
          <ActionLink href="/tracking" label="Suivi" primary />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatTile label="Ouvertes" value={data.openCount} hint="Affectées et à traiter" />
        <StatTile
          label="En cours"
          value={data.current.length}
          tone={data.current.length > 0 ? "default" : "good"}
        />
        <StatTile
          label="En retard"
          value={data.overdueCount}
          hint="Fin prévue dépassée"
          tone={data.overdueCount > 0 ? "danger" : "good"}
        />
        <StatTile label="Terminées (7 j)" value={data.doneThisWeek} tone="good" />
        <StatTile label="Heures (7 j)" value={`${data.hoursThisWeek} h`} />
        <StatTile
          label="Satisfaction"
          value={data.satisfaction === null ? "—" : `${data.satisfaction} / 5`}
          hint="Moyenne de vos interventions"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Aujourd'hui" hint="Vos interventions planifiées ce jour" href="/planning">
          <ItemList
            items={data.today}
            empty="Aucune intervention planifiée aujourd'hui."
          />
        </Panel>

        <Panel
          title="En cours"
          hint="Interventions démarrées, à terminer"
          href="/requests?status=EN_COURS"
        >
          <ItemList items={data.current} empty="Aucune intervention démarrée." />
        </Panel>
      </div>

      <Panel title="Ma file" hint="Priorité la plus haute d'abord" href="/requests">
        <ItemList items={data.queue} empty="Aucune intervention affectée pour le moment." />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Pièces utilisées récemment"
          hint="Déclarations de consommation"
          href="/stock"
        >
          {data.partsUsed.length === 0 ? (
            <Empty>Aucune pièce déclarée.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.partsUsed.map((usage) => (
                <li key={usage.id}>
                  <Link
                    href={`/requests/${usage.interventionId}`}
                    className="console-row flex items-center gap-3 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground/90">
                        {usage.name} × {usage.quantity}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] text-[#1a4a7a]">
                          {usage.reference}
                        </span>{" "}
                        · {formatDateTime(usage.usedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatMad(usage.cost)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Mes compétences" hint="Niveaux déclarés (1 à 5)">
          {data.skills.length === 0 ? (
            <Empty>Aucune compétence déclarée.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.skills.map((skill) => (
                <KeyRow
                  key={skill.id}
                  title={skill.name}
                  value={<Tag tone={skill.level >= 4 ? "good" : "neutral"}>Niveau {skill.level}</Tag>}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {data.waitingParts.length > 0 ? (
        <Panel
          title="En attente de pièces"
          hint="Vos interventions bloquées par le stock"
          href="/requests?status=EN_ATTENTE_PIECES"
        >
          <ItemList items={data.waitingParts} empty="" />
        </Panel>
      ) : null}
    </div>
  );
}

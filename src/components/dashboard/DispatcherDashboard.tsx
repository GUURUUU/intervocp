import { ActionLink, Empty, ItemList, KeyRow, Panel, StatTile, Tag } from "@/components/dashboard/parts";
import { AVAILABILITY_LABELS, formatDate } from "@/lib/format";
import type { DispatcherDashboard as DispatcherData } from "@/server/services/dashboard";

export default function DispatcherDashboard({
  data,
  userName,
}: {
  data: DispatcherData;
  userName: string;
}) {
  const availableTechs = data.technicianLoad.filter((t) => t.available).length;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Poste de répartition</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(new Date())} · Affectations, plan du jour et charge de
            l&rsquo;équipe — <span className="font-medium text-foreground">{userName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionLink href="/requests" label="Demandes" />
          <ActionLink href="/planning" label="Planifier une intervention" primary />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="À affecter"
          value={data.newCount}
          hint="Demandes au statut Nouvelle"
          tone={data.newCount > 0 ? "warning" : "good"}
        />
        <StatTile label="Planifiées aujourd'hui" value={data.todayPlanCount} />
        <StatTile label="À venir (7 j)" value={data.weekPlan} hint="Planifiées et en cours" />
        <StatTile
          label="En attente de pièces"
          value={data.waitingParts.length}
          tone={data.waitingParts.length > 0 ? "warning" : "good"}
        />
        <StatTile
          label="Techniciens disponibles"
          value={`${availableTechs}/${data.technicianLoad.length}`}
          hint="Aucune absence déclarée"
          tone={availableTechs > 0 ? "good" : "danger"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="File d'affectation"
          hint="Les plus urgentes et les plus anciennes d'abord"
          href="/planning"
        >
          <ItemList items={data.unassigned} empty="Aucune demande non affectée. File vide." />
        </Panel>

        <Panel title="Plan du jour" hint="Interventions prévues aujourd'hui" href="/planning">
          <ItemList items={data.todayPlan} empty="Rien de planifié aujourd'hui." />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Charge des techniciens"
          hint="Interventions ouvertes et disponibilité"
          href="/planning"
        >
          {data.technicianLoad.length === 0 ? (
            <Empty>Aucun technicien actif.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.technicianLoad.map((tech) => (
                <KeyRow
                  key={tech.id}
                  title={tech.name}
                  subtitle={
                    tech.phone
                      ? `${tech.phone}${tech.critical > 0 ? ` · ${tech.critical} critique(s)` : ""}`
                      : tech.critical > 0
                        ? `${tech.critical} critique(s)`
                        : "Aucune urgence"
                  }
                  value={
                    tech.available ? (
                      <span className="flex items-center gap-1.5">
                        <Tag tone={tech.open > 3 ? "warn" : "neutral"}>{tech.open} ouverte(s)</Tag>
                        <Tag tone="good">Disponible</Tag>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Tag tone={tech.open > 3 ? "warn" : "neutral"}>{tech.open} ouverte(s)</Tag>
                        <Tag tone="bad">
                          {tech.awayType
                            ? AVAILABILITY_LABELS[tech.awayType]
                            : "Indisponible"}
                        </Tag>
                      </span>
                    )
                  }
                />
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Bloquées par les pièces" hint="En attente de réapprovisionnement" href="/requests?status=EN_ATTENTE_PIECES">
            <ItemList items={data.waitingParts} empty="Aucune intervention bloquée." />
          </Panel>

          <Panel title="Stock à réapprovisionner" hint="Pièces sous le seuil" href="/stock">
            {data.lowStock.length === 0 ? (
              <Empty>Stock sain, rien à commander.</Empty>
            ) : (
              <ul className="space-y-2">
                {data.lowStock.map((part) => (
                  <KeyRow
                    key={part.id}
                    title={part.name}
                    subtitle={`Seuil minimum : ${part.minThreshold}`}
                    value={
                      <Tag tone={part.quantity === 0 ? "bad" : "warn"}>
                        {part.quantity} en stock
                      </Tag>
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

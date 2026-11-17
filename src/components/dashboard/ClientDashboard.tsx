import Link from "next/link";
import { ActionLink, Empty, ItemList, KeyRow, Panel, StatTile, Tag } from "@/components/dashboard/parts";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ClientDashboard as ClientData } from "@/server/services/dashboard";

export default function ClientDashboard({
  data,
  userName,
}: {
  data: ClientData;
  userName: string;
}) {
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Mes demandes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(new Date())} · Suivi de vos interventions et de vos
            équipements — <span className="font-medium text-foreground">{userName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionLink href="/reports" label="Mes rapports" />
          <ActionLink href="/requests" label="Nouvelle demande" primary />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Ouvertes" value={data.stats.open} hint="En cours de traitement" />
        <StatTile label="Interventions en cours" value={data.stats.inProgress} />
        <StatTile
          label="En attente de pièces"
          value={data.stats.waitingParts}
          tone={data.stats.waitingParts > 0 ? "warning" : "default"}
        />
        <StatTile label="Clôturées" value={data.stats.closed} tone="good" />
        <StatTile
          label="Ma satisfaction"
          value={data.avgSatisfaction === null ? "—" : `${data.avgSatisfaction} / 5`}
          hint="Moyenne de vos évaluations"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Suivi de mes demandes"
          hint="Vos interventions encore ouvertes"
          href="/requests"
        >
          <ItemList
            items={data.open}
            empty="Aucune demande en cours. Tout est traité."
          />
        </Panel>

        <Panel
          title="À évaluer"
          hint="Interventions clôturées sans votre avis"
          href="/requests?status=CLOTUREE"
        >
          {data.toRate.length === 0 ? (
            <Empty>Merci, toutes vos interventions sont évaluées.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.toRate.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/requests/${item.id}`}
                    className="console-row flex items-center gap-3 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground/90">
                        {item.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] text-[#1a4a7a]">
                          {item.reference}
                        </span>
                        {item.closedAt ? ` · clôturée le ${formatDateTime(item.closedAt)}` : ""}
                      </span>
                    </span>
                    <Tag tone="warn">Donner mon avis</Tag>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Mes équipements" hint="Matériel concerné par vos demandes">
          {data.equipment.length === 0 ? (
            <Empty>Aucun équipement rattaché à vos demandes.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.equipment.map((equipment) => (
                <KeyRow
                  key={equipment.name}
                  title={equipment.name}
                  subtitle={`${equipment.location} · ${equipment.category}`}
                  value={<Tag tone="info">{equipment.category}</Tag>}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Mes évaluations" hint="Vos derniers retours">
          {data.feedback.length === 0 ? (
            <Empty>Vous n&rsquo;avez pas encore évalué d&rsquo;intervention.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.feedback.map((entry) => (
                <li key={entry.id} className="console-row px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-foreground/90">{entry.title}</span>
                    <Tag tone={entry.rating >= 4 ? "good" : entry.rating >= 3 ? "warn" : "bad"}>
                      {entry.rating} / 5
                    </Tag>
                  </div>
                  {entry.comment ? (
                    <p className="mt-1 line-clamp-2 text-[11px] italic text-muted-foreground">
                      « {entry.comment} »
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Un problème sur votre poste ? Décrivez-le, le service informatique prend
          le relais.
        </p>
        <ActionLink href="/requests" label="Créer une demande" primary />
      </div>
    </div>
  );
}

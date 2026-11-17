import Link from "next/link";
import { ShieldAlert, Users } from "lucide-react";
import {
  ActionLink,
  Empty,
  ItemList,
  KeyRow,
  Panel,
  StatTile,
  Tag,
} from "@/components/dashboard/parts";
import { ROLE_LABELS, STATUS_LABELS, formatDate, formatDateTime } from "@/lib/format";
import type { AdminDashboard as AdminData } from "@/server/services/dashboard";
import type { Role } from "@prisma/client";

const ROLE_ORDER: Role[] = ["ADMIN", "MANAGER", "DISPATCHER", "TECHNICIAN", "CLIENT"];

export default function AdminDashboard({
  data,
  userName,
}: {
  data: AdminData;
  userName: string;
}) {
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Console d&rsquo;administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(new Date())} · Comptes, santé du service et alertes système —{" "}
            <span className="font-medium text-foreground">{userName}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionLink href="/admin" label="Gérer les utilisateurs" />
          <ActionLink href="/reports" label="Rapports" primary />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Utilisateurs"
          value={data.totalUsers}
          hint={`${data.inactiveUsers} compte(s) désactivé(s)`}
        />
        <StatTile label="Interventions" value={data.interventions} hint="Toutes périodes" />
        <StatTile
          label="En cours de traitement"
          value={data.openCount}
          hint="Nouvelles, planifiées, en cours"
          tone={data.openCount > 0 ? "default" : "good"}
        />
        <StatTile label="Clôturées (7 j)" value={data.closedThisWeek} tone="good" />
        <StatTile
          label="Alertes stock"
          value={data.lowStock.length}
          hint="Sous le seuil minimum"
          tone={data.lowStock.length > 0 ? "warning" : "good"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Non affectées"
          hint="Demandes sans technicien, par priorité"
          href="/planning"
        >
          <ItemList items={data.unassigned} empty="Toutes les demandes ont un technicien." />
        </Panel>

        <Panel
          title="Alertes de stock"
          hint="Pièces sous le seuil minimum"
          href="/stock"
        >
          {data.lowStock.length === 0 ? (
            <Empty>Aucune pièce sous le seuil.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.lowStock.map((part) => (
                <KeyRow
                  key={part.id}
                  href={`/stock?search=${encodeURIComponent(part.reference)}`}
                  title={part.name}
                  subtitle={`${part.reference} · seuil ${part.minThreshold}${part.location ? ` · ${part.location}` : ""}`}
                  value={
                    <Tag tone={part.quantity === 0 ? "bad" : "warn"}>
                      {part.quantity} restant(s)
                    </Tag>
                  }
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Comptes par rôle" hint={`${data.totalUsers} utilisateur(s) au total`} href="/admin">
          <ul className="space-y-2">
            {ROLE_ORDER.map((role) => (
              <KeyRow
                key={role}
                title={ROLE_LABELS[role]}
                value={data.roleCounts[role]}
                valueClass="text-foreground tabular-nums"
              />
            ))}
          </ul>
        </Panel>

        <Panel title="Derniers comptes créés" hint="Inscriptions récentes" href="/admin">
          {data.recentUsers.length === 0 ? (
            <Empty>Aucun compte.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.recentUsers.map((account) => (
                <KeyRow
                  key={account.id}
                  title={account.name}
                  subtitle={`${account.email} · ${ROLE_LABELS[account.role]}`}
                  value={
                    <span className="flex items-center gap-1.5">
                      {account.active ? <Tag tone="good">Actif</Tag> : <Tag tone="bad">Inactif</Tag>}
                    </span>
                  }
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Activité récente"
        hint="Derniers changements de statut"
        href="/tracking"
      >
        {data.activity.length === 0 ? (
          <Empty>Aucune activité enregistrée.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.activity.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/requests/${entry.interventionId}`}
                  className="console-row flex items-center gap-3 px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground/90">
                      <span className="font-mono text-[10px] text-[#1a4a7a]">
                        {entry.reference}
                      </span>{" "}
                      {entry.title}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {entry.actor} · {formatDateTime(entry.changedAt)}
                    </span>
                  </span>
                  <Tag tone="info">{STATUS_LABELS[entry.toStatus]}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass-panel flex items-center gap-3 rounded-xl px-4 py-3">
          <Users className="h-4 w-4 text-[#1a4a7a]" aria-hidden="true" />
          <span className="text-sm text-foreground/80">
            {data.roleCounts.TECHNICIAN} technicien(s) actif(s)
          </span>
        </div>
        <div className="glass-panel flex items-center gap-3 rounded-xl px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
          <span className="text-sm text-foreground/80">
            {data.lowStock.length} alerte(s) de stock
          </span>
        </div>
        <div className="glass-panel flex items-center justify-between rounded-xl px-4 py-3">
          <span className="text-sm text-foreground/80">Paramètres système</span>
          <ActionLink href="/admin" label="Ouvrir" />
        </div>
      </div>
    </div>
  );
}

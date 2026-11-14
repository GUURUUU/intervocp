import { NextResponse } from "next/server";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { requireSession } from "@/lib/auth/rbac";
import { handleRoute } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  formatDateTime,
  formatMad,
} from "@/lib/format";
import type { Status, Priority, InterventionType } from "@prisma/client";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a2028" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  brand: { fontSize: 18, fontWeight: 700, color: "#0e7a4b" },
  brandSub: { fontSize: 9, color: "#5b6b70", marginTop: 2 },
  ref: { fontSize: 12, fontWeight: 700, color: "#0e7a4b", textAlign: "right" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#0e7a4b",
    borderBottomWidth: 1,
    borderBottomColor: "#cfe3d8",
    paddingBottom: 3,
    marginBottom: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: { width: "48%", marginBottom: 3 },
  label: { fontSize: 7.5, color: "#7a8a90", textTransform: "uppercase" },
  value: { fontSize: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  muted: { color: "#5b6b70", fontSize: 9 },
  total: { fontSize: 11, fontWeight: 700, color: "#0e7a4b" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#9aa8ad",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/** PDF report per intervention: facts, history, parts + cost, incidents, rating. */
function ReportDocument({
  data,
}: {
  data: {
    reference: string;
    title: string;
    description: string;
    type: string;
    priority: string;
    status: string;
    locationLabel: string;
    requester: string;
    equipment: string;
    skill: string;
    planned: string;
    actual: string;
    duration: string;
    created: string;
    closed: string;
    rating: string;
    ratingComment: string;
    history: { at: string; label: string; comment: string }[];
    comments: { at: string; author: string; message: string }[];
    parts: { name: string; quantity: number; unitCost: string; total: string }[];
    partsTotal: string;
    incidents: { at: string; severity: string; description: string }[];
  };
}) {
  return (
    <Document
      title={`Rapport ${data.reference}`}
      author="IntervOCP — Groupe OCP Khouribga"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>IntervOCP</Text>
            <Text style={styles.brandSub}>Service IT — Site de Khouribga</Text>
          </View>
          <View>
            <Text style={styles.ref}>{data.reference}</Text>
            <Text style={styles.muted}>Rapport d&rsquo;intervention</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.muted}>{data.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations générales</Text>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.label}>Demandeur</Text>
              <Text style={styles.value}>{data.requester}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Équipement</Text>
              <Text style={styles.value}>{data.equipment}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Localisation</Text>
              <Text style={styles.value}>{data.locationLabel}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Compétence requise</Text>
              <Text style={styles.value}>{data.skill}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Type / Priorité / Statut</Text>
              <Text style={styles.value}>
                {data.type} · {data.priority} · {data.status}
              </Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Créée / Clôturée</Text>
              <Text style={styles.value}>{data.created} → {data.closed}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Créneau planifié</Text>
              <Text style={styles.value}>{data.planned}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Réel / Durée</Text>
              <Text style={styles.value}>{data.actual} ({data.duration})</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des statuts</Text>
          {data.history.length === 0 ? (
            <Text style={styles.muted}>Aucun changement de statut.</Text>
          ) : (
            data.history.map((h, i) => (
              <View key={i} style={styles.row}>
                <Text>{h.label}</Text>
                <Text style={styles.muted}>{h.at}{h.comment ? ` — ${h.comment}` : ""}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pièces utilisées</Text>
          {data.parts.length === 0 ? (
            <Text style={styles.muted}>Aucune pièce déclarée.</Text>
          ) : (
            <>
              {data.parts.map((p, i) => (
                <View key={i} style={styles.row}>
                  <Text>{p.name} × {p.quantity}</Text>
                  <Text>{p.total} MAD ({p.unitCost} /u)</Text>
                </View>
              ))}
              <View style={styles.row}>
                <Text style={styles.total}>Total pièces</Text>
                <Text style={styles.total}>{data.partsTotal}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incidents</Text>
          {data.incidents.length === 0 ? (
            <Text style={styles.muted}>Aucun incident signalé.</Text>
          ) : (
            data.incidents.map((inc, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text>
                  Sévérité {inc.severity} — {inc.at}
                </Text>
                <Text style={styles.muted}>{inc.description}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Échanges</Text>
          {data.comments.length === 0 ? (
            <Text style={styles.muted}>Aucun commentaire.</Text>
          ) : (
            data.comments.map((c, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text>
                  {c.author} — <Text style={styles.muted}>{c.at}</Text>
                </Text>
                <Text style={styles.muted}>{c.message}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Satisfaction client</Text>
          <Text style={styles.value}>
            {data.rating}
            {data.ratingComment ? ` — « ${data.ratingComment} »` : ""}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>IntervOCP — Gestion des interventions</Text>
          <Text>Généré le {formatDateTime(new Date().toISOString())}</Text>
        </View>
      </Page>
    </Document>
  );
}

/** GET: streams the PDF report for one intervention (role-gated). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const user = session.user;

    const intervention = await prisma.intervention.findUnique({
      where: { id },
      include: {
        requester: { select: { name: true } },
        equipment: { select: { name: true, location: true } },
        requiredSkill: { select: { name: true } },
        assignments: { include: { technician: { select: { id: true, name: true } } } },
        statusHistory: {
          orderBy: { changedAt: "asc" },
          include: { changedByUser: { select: { name: true } } },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
        incidents: { orderBy: { reportedAt: "asc" } },
        partUsages: {
          include: { part: { select: { name: true, unitCost: true } } },
        },
      },
    });

    if (!intervention) throw new ApiError(404, "Intervention introuvable");

    // Access: requester, assigned technician, office roles, MANAGER.
    const isRequester = intervention.requesterId === user.id;
    const isAssigned = intervention.assignments.some(
      (a) => a.technician.id === user.id
    );
    const isOffice =
      user.role === "ADMIN" || user.role === "DISPATCHER" || user.role === "MANAGER";
    if (!isRequester && !isAssigned && !isOffice) {
      throw new ApiError(403, "Accès refusé à ce rapport");
    }

    const durationH =
      intervention.actualStart && intervention.actualEnd
        ? Math.round(
            ((intervention.actualEnd.getTime() - intervention.actualStart.getTime()) /
              3_600_000) *
              10
          ) / 10
        : null;

    const partsTotal = intervention.partUsages.reduce(
      (s, u) => s + u.quantity * u.part.unitCost,
      0
    );

    const doc = (
      <ReportDocument
        data={{
          reference: intervention.reference,
          title: intervention.title,
          description: intervention.description,
          type: TYPE_LABELS[intervention.type as InterventionType],
          priority: PRIORITY_LABELS[intervention.priority as Priority],
          status: STATUS_LABELS[intervention.status as Status],
          locationLabel:
            intervention.locationText ??
            intervention.equipment?.location ??
            "—",
          requester: intervention.requester.name,
          equipment: intervention.equipment?.name ?? "—",
          skill: intervention.requiredSkill?.name ?? "—",
          planned: intervention.plannedStart
            ? `${formatDateTime(intervention.plannedStart.toISOString())} → ${formatDateTime(
                (intervention.plannedEnd ?? intervention.plannedStart).toISOString()
              )}`
            : "Non planifié",
          actual: intervention.actualStart
            ? `${formatDateTime(intervention.actualStart.toISOString())} → ${
                intervention.actualEnd
                  ? formatDateTime(intervention.actualEnd.toISOString())
                  : "en cours"
              }`
            : "—",
          duration: durationH !== null ? `${durationH} h` : "—",
          created: formatDateTime(intervention.createdAt.toISOString()),
          closed: intervention.closedAt
            ? formatDateTime(intervention.closedAt.toISOString())
            : "—",
          rating: intervention.satisfactionRating
            ? `${"★".repeat(intervention.satisfactionRating)}${"☆".repeat(
                5 - intervention.satisfactionRating
              )}`
            : "Non évaluée",
          ratingComment: intervention.satisfactionComment ?? "",
          history: intervention.statusHistory.map((h) => ({
            at: formatDateTime(h.changedAt.toISOString()),
            label: `${h.changedByUser.name} : ${
              h.fromStatus
                ? `${STATUS_LABELS[h.fromStatus as Status]} → `
                : ""
            }${STATUS_LABELS[h.toStatus as Status]}`,
            comment: h.comment ?? "",
          })),
          comments: intervention.comments.map((c) => ({
            at: formatDateTime(c.createdAt.toISOString()),
            author: c.author.name,
            message: c.message,
          })),
          parts: intervention.partUsages.map((u) => ({
            name: u.part.name,
            quantity: u.quantity,
            unitCost: formatMad(u.part.unitCost),
            total: formatMad(u.quantity * u.part.unitCost),
          })),
          partsTotal: formatMad(partsTotal),
          incidents: intervention.incidents.map((i) => ({
            at: formatDateTime(i.reportedAt.toISOString()),
            severity: i.severity,
            description: i.description,
          })),
        }}
      />
    );

    const buffer = await renderToBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="rapport-${intervention.reference}.pdf"`,
      },
    });
  });
}

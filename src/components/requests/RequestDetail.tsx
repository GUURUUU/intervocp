"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  FileUp,
  MapPin,
  MessageSquare,
  Send,
  TriangleAlert,
  UserCog,
} from "lucide-react";
import type { Role, Status } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SuggestDialog from "@/components/planning/SuggestDialog";
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_BADGE_CLASS,
  formatDateTime,
  formatDuration,
  formatMad,
} from "@/lib/format";
import { STATUS_TRANSITIONS } from "@/lib/status";
import LiquidGlassCard from "@/components/glass/LiquidGlassCard";

interface CommentItem {
  id: string;
  message: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
}

interface HistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  comment: string | null;
  changedAt: string;
  changedByUser: { id: string; name: string };
}

interface AttachmentItem {
  id: string;
  fileName: string;
  kind: string;
  createdAt: string;
  uploadedByUser: { id: string; name: string };
}

interface IncidentItem {
  id: string;
  description: string;
  severity: string;
  reportedAt: string;
}

interface PartUsageItem {
  id: string;
  quantity: number;
  usedAt: string;
  part: { id: string; name: string; reference: string; unitCost: number };
  user: { id: string; name: string };
}

interface RequestDetailData {
  id: string;
  reference: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: Status;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  createdAt: string;
  closedAt: string | null;
  satisfactionRating: number | null;
  satisfactionComment: string | null;
  requester: { id: string; name: string; email: string };
  equipment: { id: string; name: string; location: string; category: string } | null;
  requiredSkill: { id: string; name: string } | null;
  assignments: { id: string; technician: { id: string; name: string } }[];
  statusHistory: HistoryItem[];
  comments: CommentItem[];
  attachments: AttachmentItem[];
  incidents: IncidentItem[];
  partUsages: PartUsageItem[];
}

interface RequestDetailProps {
  id: string;
  role: Role;
  userId: string;
}

/** Allowed next statuses for the current user (server enforces again). */
function allowedTransitions(status: Status, role: Role): Status[] {
  const base = STATUS_TRANSITIONS[status] ?? [];
  if (role === "ADMIN" || role === "DISPATCHER") return base;
  if (role === "TECHNICIAN") {
    return base.filter((s) =>
      ["EN_COURS", "EN_ATTENTE_PIECES", "TERMINEE"].includes(s)
    );
  }
  if (role === "CLIENT") return base.filter((s) => s === "ANNULEE");
  return [];
}

export default function RequestDetail({ id, role, userId }: RequestDetailProps) {
  const [data, setData] = useState<RequestDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Status | "NONE">("NONE");
  const [statusComment, setStatusComment] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("MEDIUM");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Erreur de chargement");
        return;
      }
      setData((await res.json()) as RequestDetailData);
    } catch {
      setError("Erreur réseau");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const postComment = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId: id, message: message.trim() }),
      });
      if (res.ok) {
        setMessage("");
        await load();
      }
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async () => {
    if (statusTarget === "NONE") return;
    const res = await fetch(`/api/requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus: statusTarget,
        comment: statusComment || undefined,
      }),
    });
    if (res.ok) {
      setStatusTarget("NONE");
      setStatusComment("");
      await load();
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Transition refusée");
    }
  };

  const upload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", file);
        await fetch(`/api/requests/${id}/attachments`, { method: "POST", body: form });
      }
      await load();
    } finally {
      setUploading(false);
    }
  };

  const declareIncident = async () => {
    if (!incidentDesc.trim()) return;
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interventionId: id,
        description: incidentDesc.trim(),
        severity: incidentSeverity,
      }),
    });
    if (res.ok) {
      setIncidentDesc("");
      await load();
    }
  };

  const submitRating = async () => {
    const res = await fetch(`/api/requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: ratingComment || undefined }),
    });
    if (res.ok) await load();
  };

  if (error && !data) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center">
        <p className="text-rose-600">{error}</p>
        <Link href="/requests" className="mt-4 inline-block text-emerald-700 hover:underline">
          ← Retour aux demandes
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="glass-panel h-96 animate-pulse rounded-xl" />;
  }

  const isRequester = data.requester.id === userId;
  const canRate = role === "CLIENT" && isRequester && data.status === "CLOTUREE" && !data.satisfactionRating;
  const canDeclareIncident = role === "TECHNICIAN" && data.assignments.some((a) => a.technician.id === userId) || role === "ADMIN" || role === "DISPATCHER";
  const isOffice = role === "ADMIN" || role === "DISPATCHER";
  const nextStatuses = allowedTransitions(data.status, role);
  const partsCost = data.partUsages.reduce((sum, u) => sum + u.quantity * u.part.unitCost, 0);

  // Merged activity timeline
  const timeline = [
    ...data.statusHistory.map((h) => ({
      kind: "status" as const,
      at: h.changedAt,
      item: h,
    })),
    ...data.comments.map((c) => ({
      kind: "comment" as const,
      at: c.createdAt,
      item: c,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/requests" className="text-sm text-muted-foreground/80 hover:text-foreground">
          <ArrowLeft className="mr-1 inline h-4 w-4" /> Retour aux demandes
        </Link>
        <div className="flex items-center gap-2">
          {isOffice ? (
            <Button size="sm" onClick={() => setSuggestOpen(true)}>
              <UserCog className="mr-1 h-4 w-4" /> Affecter / suggérer
            </Button>
          ) : null}
        </div>
      </div>

      {/* Title card */}
      <LiquidGlassCard className="rounded-2xl p-6" borderRadius={24}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-emerald-700">{data.reference}</span>
          <Badge variant="outline" className={STATUS_BADGE_CLASS[data.status]}>
            {STATUS_LABELS[data.status]}
          </Badge>
          <Badge variant="outline" className={PRIORITY_BADGE_CLASS[data.priority as never]}>
            {PRIORITY_LABELS[data.priority as never]}
          </Badge>
          <Badge variant="outline" className="border-border bg-foreground/5 text-muted-foreground">
            {TYPE_LABELS[data.type as never]}
          </Badge>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{data.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{data.description}</p>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Demandeur" value={data.requester.name} />
          <Info label="Équipement" value={data.equipment ? `${data.equipment.name}` : "—"} />
          <Info
            label="Localisation"
            value={
              data.locationText ??
              (data.equipment?.location ?? "—")
            }
            icon={<MapPin className="inline h-3 w-3" />}
          />
          <Info label="Compétence requise" value={data.requiredSkill?.name ?? "—"} />
          <Info
            label="Créneau planifié"
            value={
              data.plannedStart
                ? `${formatDateTime(data.plannedStart)} → ${formatDateTime(data.plannedEnd)}`
                : "Non planifié"
            }
            icon={<CalendarDays className="inline h-3 w-3" />}
          />
          <Info
            label="Durée réelle"
            value={
              data.actualStart && data.actualEnd
                ? formatDuration(data.actualStart, data.actualEnd)
                : data.actualStart
                  ? "En cours…"
                  : "—"
            }
          />
          <Info label="Créée le" value={formatDateTime(data.createdAt)} />
          <Info label="Coût pièces" value={partsCost > 0 ? formatMad(partsCost) : "—"} />
        </div>
      </LiquidGlassCard>

      {/* Status change panel (role-aware) */}
      {nextStatuses.length > 0 ? (
        <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
          <p className="mb-2 text-sm font-semibold text-foreground">Changer le statut</p>
          <div className="flex flex-wrap items-end gap-2">
            <Select value={statusTarget} onValueChange={(v) => setStatusTarget(v as Status)}>
              <SelectTrigger className="w-52" aria-label="Nouveau statut">
                <SelectValue placeholder="Choisir un statut…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE" disabled>Choisir…</SelectItem>
                {nextStatuses.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Commentaire (optionnel)"
              className="w-64"
            />
            <Button size="sm" disabled={statusTarget === "NONE"} onClick={() => void changeStatus()}>
              Appliquer
            </Button>
          </div>
        </LiquidGlassCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: attachments + incidents */}
        <div className="space-y-4">
          <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
            <p className="mb-3 flex items-center justify-between text-sm font-semibold text-foreground">
              <span>Pièces jointes ({data.attachments.length})</span>
              <label className="cursor-pointer text-emerald-700 hover:text-emerald-800">
                <FileUp className="inline h-4 w-4" />
                <span className="ml-1 text-xs">
                  {uploading ? "Envoi…" : "Ajouter"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.txt"
                  multiple
                  onChange={(e) => void upload(e.target.files)}
                />
              </label>
            </p>
            {data.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>
            ) : (
              <ul className="space-y-2">
                {data.attachments.map((att) => (
                  <li key={att.id} className="glass-panel-soft flex items-center gap-2 rounded-lg p-2">
                    {att.kind === "PHOTO" ? (
                      <Camera className="h-4 w-4 shrink-0 text-emerald-700" />
                    ) : (
                      <FileUp className="h-4 w-4 shrink-0 text-sky-700" />
                    )}
                    <a
                      href={`/api/attachments/${att.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-emerald-800"
                    >
                      {att.fileName}
                    </a>
                    <span className="text-[10px] text-muted-foreground/70">
                      {att.uploadedByUser.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </LiquidGlassCard>

          <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
            <p className="mb-3 text-sm font-semibold text-foreground">
              Incidents ({data.incidents.length})
            </p>
            <ul className="space-y-2">
              {data.incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun incident signalé.</p>
              ) : (
                data.incidents.map((inc) => (
                  <li key={inc.id} className="glass-panel-soft rounded-lg p-2 text-sm">
                    <p className="flex items-center gap-1 text-amber-500">
                      <TriangleAlert className="h-3 w-3" />
                      Sévérité {inc.severity}
                    </p>
                    <p className="text-foreground/80">{inc.description}</p>
                    <p className="text-[10px] text-muted-foreground/70">{formatDateTime(inc.reportedAt)}</p>
                  </li>
                ))
              )}
            </ul>
            {canDeclareIncident ? (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <Textarea
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Signaler un incident (accès impossible, pièce manquante…)"
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                    <SelectTrigger className="w-32" aria-label="Sévérité">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Faible</SelectItem>
                      <SelectItem value="MEDIUM">Moyenne</SelectItem>
                      <SelectItem value="HIGH">Élevée</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="secondary" onClick={() => void declareIncident()}>
                    Signaler
                  </Button>
                </div>
              </div>
            ) : null}
          </LiquidGlassCard>

          {/* Parts used */}
          <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
            <p className="mb-3 text-sm font-semibold text-foreground">Pièces utilisées</p>
            {data.partUsages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune pièce déclarée.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.partUsages.map((u) => (
                  <li key={u.id} className="flex items-center justify-between text-foreground/80">
                    <span>
                      {u.part.name} <span className="text-muted-foreground/70">× {u.quantity}</span>
                    </span>
                    <span className="font-mono text-xs text-emerald-700">
                      {formatMad(u.quantity * u.part.unitCost)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </LiquidGlassCard>
        </div>

        {/* Right: timeline + comments */}
        <div className="space-y-4 lg:col-span-2">
          <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
            <p className="mb-3 text-sm font-semibold text-foreground">Activité</p>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {timeline.map((entry) => (
                <li key={entry.item.id} className="relative">
                  <span
                    className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-popover ${
                      entry.kind === "status" ? "bg-emerald-400" : "bg-sky-400"
                    }`}
                    aria-hidden="true"
                  />
                  {entry.kind === "status" ? (
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">
                          {(entry.item as HistoryItem).changedByUser.name}
                        </span>{" "}
                        {((entry.item as HistoryItem).fromStatus
                          ? `${STATUS_LABELS[(entry.item as HistoryItem).fromStatus as never]} → `
                          : "") + STATUS_LABELS[(entry.item as HistoryItem).toStatus as never]}
                      </p>
                      {(entry.item as HistoryItem).comment ? (
                        <p className="text-xs text-muted-foreground/80">
                          {(entry.item as HistoryItem).comment}
                        </p>
                      ) : null}
                      <p className="text-[10px] text-muted-foreground/70">
                        {formatDateTime(entry.at)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-foreground/90">
                        <span className="font-medium text-sky-700">
                          {(entry.item as CommentItem).author.name}
                        </span>{" "}
                        : {(entry.item as CommentItem).message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {formatDateTime(entry.at)}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </LiquidGlassCard>

          <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageSquare className="h-4 w-4 text-emerald-700" /> Échanges
            </p>
            <ul className="space-y-3">
              {data.comments.length === 0 ? (
                <li className="text-sm text-muted-foreground">Aucun commentaire pour le moment.</li>
              ) : (
                data.comments.map((c) => (
                  <li key={c.id} className="glass-panel-soft rounded-lg p-3">
                    <p className="text-sm text-foreground/90">{c.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {c.author.name} — {formatDateTime(c.createdAt)}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-3 flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Écrire un message…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void postComment();
                  }
                }}
              />
              <Button size="icon" disabled={sending || !message.trim()} onClick={() => void postComment()} aria-label="Envoyer">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </LiquidGlassCard>

          {/* Satisfaction rating (client) */}
          {canRate ? (
            <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
              <p className="mb-2 text-sm font-semibold text-foreground">Votre satisfaction</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n} étoile(s)`}
                    className={`text-2xl transition ${n <= rating ? "text-amber-500" : "text-foreground/20"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Commentaire (optionnel)"
              />
              <Button size="sm" className="mt-2" onClick={() => void submitRating()}>
                Envoyer la note
              </Button>
            </LiquidGlassCard>
          ) : null}

          {data.satisfactionRating ? (
            <LiquidGlassCard className="rounded-xl p-4" borderRadius={16}>
              <p className="text-sm font-semibold text-foreground">
                Satisfaction client : <span className="text-amber-500">{"★".repeat(data.satisfactionRating)}</span>
                {"☆".repeat(5 - data.satisfactionRating)}
              </p>
              {data.satisfactionComment ? (
                <p className="mt-1 text-sm text-muted-foreground">« {data.satisfactionComment} »</p>
              ) : null}
            </LiquidGlassCard>
          ) : null}
        </div>
      </div>

      <SuggestDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        interventionId={data.id}
        interventionReference={data.reference}
        plannedStart={data.plannedStart ? new Date(data.plannedStart) : defaultSlotStart()}
        plannedEnd={data.plannedEnd ? new Date(data.plannedEnd) : defaultSlotEnd()}
        onAssigned={load}
      />
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass-panel-soft rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-sm text-foreground/90">{value}</p>
    </div>
  );
}

/** Default suggestion slot: tomorrow 8:00–10:00. */
function defaultSlotStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}
function defaultSlotEnd(): Date {
  const d = defaultSlotStart();
  d.setHours(10, 0, 0, 0);
  return d;
}

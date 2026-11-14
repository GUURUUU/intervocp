"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
} from "lucide-react";
import type { Status, Priority, InterventionType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_BADGE_CLASS,
  formatDateTime,
} from "@/lib/format";
import CreateRequestDialog from "./CreateRequestDialog";
import type { Role } from "@prisma/client";
import { useEventStream } from "@/hooks/use-event-stream";

export interface RequestListItem {
  id: string;
  reference: string;
  title: string;
  description: string;
  type: InterventionType;
  priority: Priority;
  status: Status;
  locationText: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  createdAt: string;
  requester: { id: string; name: string };
  equipment: { id: string; name: string; location: string } | null;
  requiredSkill: { id: string; name: string } | null;
  assignments: { technician: { id: string; name: string } }[];
}

interface RequestsBrowserProps {
  role: Role;
}

const PAGE_SIZE = 9;

/** Glass card list of intervention requests with filters + pagination. */
export default function RequestsBrowser({ role }: RequestsBrowserProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [type, setType] = useState<InterventionType | "ALL">("ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: RequestListItem[];
    total: number;
    page: number;
    pages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (type !== "ALL") params.set("type", type);
    if (priority !== "ALL") params.set("priority", priority);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [search, status, type, priority, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/requests?${query}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live refresh through SSE (any intervention change).
  useEventStream(
    useCallback(
      (event) => {
        if (event.type.startsWith("intervention.")) void load();
      },
      [load]
    )
  );

  const canCreate = role !== "MANAGER";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher (référence, titre, description)…"
            className="pl-9"
            aria-label="Recherche"
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as Status | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as InterventionType | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filtrer par type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={priority}
          onValueChange={(v) => {
            setPriority(v as Priority | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filtrer par priorité">
            <Filter className="h-4 w-4" />
            <SelectValue placeholder="Priorité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes priorités</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canCreate ? (
          <CreateRequestDialog onCreated={load}>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Nouvelle demande
            </Button>
          </CreateRequestDialog>
        ) : null}
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-panel-soft h-44 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center text-muted-foreground">
          Aucune demande ne correspond à ces critères.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <Link
              key={item.id}
              href={`/requests/${item.id}`}
              className="glass-panel group block rounded-xl p-4 transition-transform hover:scale-[1.01]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-emerald-700">{item.reference}</span>
                <Badge variant="outline" className={STATUS_BADGE_CLASS[item.status]}>
                  {STATUS_LABELS[item.status]}
                </Badge>
              </div>
              <h3 className="line-clamp-1 font-semibold text-foreground group-hover:text-emerald-700">
                {item.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground/80">{item.description}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className={PRIORITY_BADGE_CLASS[item.priority]}>
                  {PRIORITY_LABELS[item.priority]}
                </Badge>
                <Badge variant="outline" className="border-border bg-foreground/5 text-muted-foreground">
                  {TYPE_LABELS[item.type]}
                </Badge>
                {item.equipment ? (
                  <span className="text-muted-foreground/70">{item.equipment.name}</span>
                ) : item.locationText ? (
                  <span className="text-muted-foreground/70">{item.locationText}</span>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                <span>Par {item.requester.name}</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
              {item.assignments.length > 0 ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Technicien : {item.assignments.map((a) => a.technician.name).join(", ")}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data?.page ?? page} / {data.pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

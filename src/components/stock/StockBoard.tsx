"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, PackagePlus, Plus, Search } from "lucide-react";
import type { Part, Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEventStream } from "@/hooks/use-event-stream";
import { formatMad } from "@/lib/format";

interface StockUserProps {
  role: Role;
}

type PartDto = Pick<
  Part,
  "id" | "reference" | "name" | "quantity" | "minThreshold" | "unitCost" | "location"
>;

function isLow(p: PartDto): boolean {
  return p.quantity < p.minThreshold;
}

/** Create-part dialog (ADMIN). */
function CreatePartDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: form.get("reference"),
        name: form.get("name"),
        quantity: Number(form.get("quantity") ?? 0),
        minThreshold: Number(form.get("minThreshold") ?? 5),
        unitCost: Number(form.get("unitCost") ?? 0),
        location: String(form.get("location") ?? "") || null,
      }),
    });
    if (res.ok) {
      setOpen(false);
      onCreated();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Échec de la création");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nouvelle pièce
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md border-border bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter une pièce au catalogue</DialogTitle>
          <DialogDescription>
            Référence, seuil d&rsquo;alerte et coût unitaire (MAD).
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="p-ref">Référence</Label>
            <Input id="p-ref" name="reference" required minLength={2} maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nom</Label>
            <Input id="p-name" name="name" required minLength={2} maxLength={120} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-qty">Quantité</Label>
              <Input id="p-qty" name="quantity" type="number" min={0} defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-thr">Seuil</Label>
              <Input id="p-thr" name="minThreshold" type="number" min={0} defaultValue={5} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">Coût (MAD)</Label>
              <Input id="p-cost" name="unitCost" type="number" min={0} step="0.01" defaultValue={0} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-loc">Emplacement (optionnel)</Label>
            <Input id="p-loc" name="location" placeholder="Magasin central, étagère B3" />
          </div>
          {error ? (
            <p role="alert" className="text-xs text-rose-600">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="submit" className="w-full">Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Restock dialog (ADMIN/DISPATCHER). */
function RestockDialog({ part, onDone }: { part: PartDto; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/parts/${part.id}/restock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: Number(form.get("qty")) }),
    });
    if (res.ok) {
      setOpen(false);
      onDone();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Échec du réapprovisionnement");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px]"
          aria-label={`Réapprovisionner ${part.name}`}
        >
          <PackagePlus className="mr-1 h-3.5 w-3.5" /> Réappro.
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs border-border bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Réapprovisionner</DialogTitle>
          <DialogDescription className="text-xs">
            {part.name} — stock actuel : {part.quantity}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor={`qty-${part.id}`}>Quantité ajoutée</Label>
            <Input
              id={`qty-${part.id}`}
              name="qty"
              type="number"
              min={1}
              max={100000}
              defaultValue={10}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-xs text-rose-600">{error}</p>
          ) : null}
          <Button type="submit" className="w-full" size="sm">Valider</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Stock page: glass catalogue cards + low-stock badges. */
export default function StockBoard({ role }: StockUserProps) {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [parts, setParts] = useState<PartDto[]>([]);
  const [lowCount, setLowCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const canManage =
    role === "ADMIN" || role === "DISPATCHER";
  const canCreate = role === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (lowOnly) params.set("low", "1");
      const res = await fetch(`/api/parts?${params}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { items: PartDto[]; lowCount: number };
        setParts(data.items);
        setLowCount(data.lowCount);
      }
    } finally {
      setLoading(false);
    }
  }, [search, lowOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEventStream(
    useCallback(
      (event) => {
        if (event.type === "stock.low" || event.type.startsWith("intervention.")) {
          void load();
        }
      },
      [load]
    )
  );

  const totals = useMemo(() => {
    const value = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0);
    return { count: parts.length, value };
  }, [parts]);

  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une pièce ou une référence…"
            className="pl-9"
            aria-label="Recherche de pièce"
          />
        </div>
        <Button
          size="sm"
          variant={lowOnly ? "default" : "outline"}
          onClick={() => setLowOnly((v) => !v)}
          aria-pressed={lowOnly}
        >
          <AlertTriangle className="mr-1 h-4 w-4" />
          Stock bas {lowCount > 0 ? `(${lowCount})` : ""}
        </Button>
        {canCreate ? <CreatePartDialog onCreated={load} /> : null}
        <span className="text-xs text-muted-foreground">
          {totals.count} pièces · Valeur ≈ {formatMad(totals.value)}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-panel-soft h-36 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : parts.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center text-muted-foreground">
          Aucune pièce ne correspond à ces critères.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {parts.map((part) => (
            <div
              key={part.id}
              className={`glass-panel rounded-xl p-4 ${
                isLow(part) ? "ring-1 ring-rose-400/60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {part.reference}
                </span>
                {isLow(part) ? (
                  <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-200">
                    Stock bas
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                {part.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {part.location ?? "Emplacement non précisé"}
              </p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className={`text-lg font-bold ${isLow(part) ? "text-rose-600" : "text-foreground"}`}>
                    {part.quantity}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    seuil : {part.minThreshold}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatMad(part.unitCost)} /u
                </p>
              </div>
              {canManage ? (
                <div className="mt-3">
                  <RestockDialog part={part} onDone={load} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

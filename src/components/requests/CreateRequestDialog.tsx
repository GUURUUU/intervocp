"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TYPE_LABELS, PRIORITY_LABELS } from "@/lib/format";
import ShaderGradientBackground from "@/components/design/ShaderGradientBackground";

interface EquipmentOption {
  id: string;
  name: string;
  location: string;
}

interface SkillOption {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Création…" : "Créer la demande"}
    </Button>
  );
}

interface CreateRequestDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

/** Create-request dialog with a ShaderGradient header + glass body. */
export default function CreateRequestDialog({
  children,
  onCreated,
}: CreateRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [eqRes, skRes] = await Promise.all([
        fetch("/api/equipment", { cache: "no-store" }),
        fetch("/api/skills", { cache: "no-store" }),
      ]);
      if (eqRes.ok) setEquipment(((await eqRes.json()) as { items: EquipmentOption[] }).items);
      if (skRes.ok) setSkills((await skRes.json()) as SkillOption[]);
    })();
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      type: form.get("type"),
      priority: form.get("priority"),
      equipmentId: form.get("equipmentId") || null,
      requiredSkillId: form.get("requiredSkillId") || null,
      locationText: String(form.get("locationText") ?? "") || null,
    };

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setOpen(false);
      onCreated?.();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Échec de la création");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-popover/95 p-0 backdrop-blur-2xl">
        <div className="relative h-28 overflow-hidden">
          <ShaderGradientBackground className="absolute inset-0" />
          <div className="relative z-10 flex h-full items-center px-6">
            <div>
              <DialogHeader>
                <DialogTitle className="text-white">Nouvelle demande d&rsquo;intervention</DialogTitle>
              </DialogHeader>
              <DialogDescription className="text-white/70">
                Décrivez le problème ou le besoin de maintenance.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form className="space-y-4 p-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" required minLength={3} maxLength={150} placeholder="Ex : Panne du convoyeur principal" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required minLength={5} rows={4} placeholder="Symptômes, contexte, impact…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue="CORRECTIVE"
                className="h-9 w-full rounded-md border border-border bg-foreground/5 px-2 text-sm"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <select
                id="priority"
                name="priority"
                defaultValue="MEDIUM"
                className="h-9 w-full rounded-md border border-border bg-foreground/5 px-2 text-sm"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipmentId">Équipement concerné (optionnel)</Label>
            <select
              id="equipmentId"
              name="equipmentId"
              className="h-9 w-full rounded-md border border-border bg-foreground/5 px-2 text-sm"
            >
              <option value="">— Aucun —</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.location})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requiredSkillId">Compétence souhaitée (optionnel)</Label>
            <select
              id="requiredSkillId"
              name="requiredSkillId"
              className="h-9 w-full rounded-md border border-border bg-foreground/5 px-2 text-sm"
            >
              <option value="">— Aucune —</option>
              {skills.map((sk) => (
                <option key={sk.id} value={sk.id}>
                  {sk.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationText">Localisation (texte libre)</Label>
            <Input id="locationText" name="locationText" placeholder="Ex : Atelier central, ligne 2" />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-rose-600">{error}</p>
          ) : null}

          <SubmitButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}

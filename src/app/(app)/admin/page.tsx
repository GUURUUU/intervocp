import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";

/** Administration overview: users, roles, skills and equipment. */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [users, equipmentCount, skillCount, openRequests] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "CLIENT" } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { technicianSkills: { include: { skill: true } } },
    }),
    prisma.equipment.count(),
    prisma.skill.count(),
    prisma.intervention.count({
      where: { status: { in: ["NOUVELLE", "PLANIFIEE", "EN_COURS", "EN_ATTENTE_PIECES"] } },
    }),
  ]);

  const clientsCount = await prisma.user.count({ where: { role: "CLIENT" } });

  const stats = [
    { label: "Utilisateurs internes", value: users.length },
    { label: "Clients", value: clientsCount },
    { label: "Équipements", value: equipmentCount },
    { label: "Compétences", value: skillCount },
    { label: "Demandes ouvertes", value: openRequests },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Vue d&rsquo;ensemble des comptes, des compétences et du parc.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="glass-panel rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Rôle</th>
              <th className="px-4 py-2 font-medium">Compétences</th>
              <th className="px-4 py-2 font-medium">Compte</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2 text-foreground/90">{u.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-foreground/80">
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {u.technicianSkills
                    .map((ts) => ts.skill.name)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-2 text-xs">
                  {u.active ? (
                    <span className="text-emerald-700">Actif</span>
                  ) : (
                    <span className="text-rose-600">Désactivé</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

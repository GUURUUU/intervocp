import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import KpiBoard from "@/components/reports/KpiBoard";

const OFFICE_ROLES = ["ADMIN", "DISPATCHER", "MANAGER"];

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canExport = OFFICE_ROLES.includes(session.user.role);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Rapports &amp; indicateurs</h1>
        <p className="text-sm text-muted-foreground">
          Tableaux de bord, taux de retard, coûts pièces et export CSV des
          interventions.
        </p>
      </div>
      <KpiBoard canExport={canExport} />
    </div>
  );
}

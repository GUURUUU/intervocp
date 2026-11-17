import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PlanningBoard from "@/components/planning/PlanningBoard";

const PLANNING_ROLES = ["ADMIN", "DISPATCHER", "TECHNICIAN"];

export default async function PlanningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!PLANNING_ROLES.includes(session.user.role)) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Planification & affectation</h1>
        <p className="text-sm text-muted-foreground">
          Calendrier hebdomadaire des techniciens et file des demandes à planifier.
        </p>
      </div>
      <PlanningBoard role={session.user.role} />
    </div>
  );
}

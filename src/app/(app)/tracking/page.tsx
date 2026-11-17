import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrackingFlow from "@/components/tracking/TrackingFlow";
import KanbanBoard from "@/components/tracking/KanbanBoard";

/**
 * Intervention status tracking: workflow stage per request (no GPS),
 * plus the drag & drop status board. CLIENT has no tracking access.
 */
export default async function TrackingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "CLIENT") redirect("/dashboard");

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Suivi des interventions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Où en est chaque demande : étape du circuit, technicien affecté et
            temps écoulé. Les changements de statut arrivent en direct.
          </p>
        </div>
      </div>

      <TrackingFlow />
      <KanbanBoard role={role} />
    </div>
  );
}

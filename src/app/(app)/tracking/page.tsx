import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ThreeLivePin from "@/components/tracking/ThreeLivePin";
import TrackingSection from "@/components/tracking/TrackingSection";
import KanbanBoard from "@/components/tracking/KanbanBoard";

/**
 * Real-time tracking page: live Leaflet map + status Kanban board.
 * CLIENT role has no tracking access (redirected).
 */
export default async function TrackingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "CLIENT") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ThreeLivePin size={52} />
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Suivi en temps réel
          </h1>
          <p className="text-sm text-muted-foreground">
            Carte des techniciens et tableau Kanban — mises à jour instantanées.
          </p>
        </div>
      </div>

      <TrackingSection role={role} />
      <KanbanBoard role={role} />
    </div>
  );
}

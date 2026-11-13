import ThreeEquipmentIcon from "@/components/three/ThreeEquipmentIcon";
import { auth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/format";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      {/* Header with 3D equipment icon */}
      <div className="brand-gradient glass-panel flex items-center justify-between rounded-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Bonjour {session?.user?.name ?? ""}
          </h1>
          <p className="text-sm text-white/60">
            {session ? ROLE_LABELS[session.user.role] : ""} — Service IT, site de
            Khouribga
          </p>
        </div>
        <ThreeEquipmentIcon size={84} />
      </div>

      {/* KPI cards are completed in Phase 4 (Reports & Dashboard module). */}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { Role } from "@prisma/client";

/** Leaflet cannot render on the server — load the map client-side only. */
const TrackingMap = dynamic(() => import("./TrackingMap"), {
  ssr: false,
  loading: () => (
    <div className="glass-panel h-[464px] animate-pulse rounded-xl" />
  ),
});

export default function TrackingSection({ role }: { role: Role }) {
  return <TrackingMap role={role} />;
}

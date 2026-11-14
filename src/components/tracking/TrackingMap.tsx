"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Crosshair, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEventStream } from "@/hooks/use-event-stream";
import { formatDateTime } from "@/lib/format";
import type { Role } from "@prisma/client";

/** Demo base coordinates: OCP industrial site, Khouribga. */
const SITE_CENTER: [number, number] = [32.8866, -6.9063];

interface LivePosition {
  technicianId: string;
  name: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface TrackingMapProps {
  role: Role;
}

/** Glass marker with the technician's initials + pulsing dot. */
function techIcon(name: string, fresh: boolean): L.DivIcon {
  const initials = name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return L.divIcon({
    className: "map-tech-marker-wrap",
    html: `<div class="map-tech-marker ${fresh ? "map-tech-fresh" : ""}">
             <span class="map-tech-pulse" aria-hidden="true"></span>
             <span class="map-tech-initials">${initials}</span>
           </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function isFresh(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() < 10 * 60 * 1000;
}

/**
 * Live Leaflet map with technician positions (OpenStreetMap tiles).
 * Office roles can run the built-in demo simulator; technicians can
 * share their real GPS position. Updates arrive through SSE.
 */
export default function TrackingMap({ role }: TrackingMapProps) {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOffice = role === "ADMIN" || role === "DISPATCHER" || role === "MANAGER";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pings", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { positions: LivePosition[] };
        setPositions(data.positions);
      }
    } catch {
      // offline — keep last known positions
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // SSE: instant refresh on new pings / any intervention change.
  useEventStream(
    useCallback(
      (event) => {
        if (event.type === "location.ping" || event.type.startsWith("intervention.")) {
          void load();
        }
      },
      [load]
    )
  );

  const simulateOnce = useCallback(async () => {
    const res = await fetch("/api/pings/simulate", { method: "POST" });
    if (res.ok) await load();
    else setMessage("Simulation indisponible");
  }, [load]);

  const toggleSimulation = useCallback(() => {
    if (simulating) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setSimulating(false);
      return;
    }
    setSimulating(true);
    void simulateOnce();
    timerRef.current = setInterval(() => void simulateOnce(), 30000);
  }, [simulating, simulateOnce]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  const shareGps = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage("Géolocalisation non disponible sur cet appareil");
      return;
    }
    setSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/pings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          });
          setMessage(
            res.ok ? "Position partagée ✓" : "Échec de l'envoi de la position"
          );
          await load();
        } finally {
          setSharing(false);
        }
      },
      () => {
        setMessage("Permission de géolocalisation refusée");
        setSharing(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [load]);

  const markers = useMemo(
    () =>
      positions.map((p) => (
        <div key={p.technicianId}>
          <Marker
            position={[p.latitude, p.longitude]}
            icon={techIcon(p.name, isFresh(p.timestamp))}
          >
            <Popup>
              <strong>{p.name}</strong>
              <br />
              Vu à {formatDateTime(p.timestamp)}
            </Popup>
          </Marker>
          <Circle
            center={[p.latitude, p.longitude]}
            radius={220}
            pathOptions={{
              color: "#10b981",
              weight: 1,
              fillColor: "#10b981",
              fillOpacity: 0.08,
            }}
          />
        </div>
      )),
    [positions]
  );

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <p className="text-sm font-semibold text-foreground">
          Positions en direct ({positions.length})
        </p>
        <div className="flex items-center gap-2">
          {isOffice ? (
            <Button
              size="sm"
              variant={simulating ? "secondary" : "outline"}
              onClick={() => void toggleSimulation()}
            >
              {simulating ? (
                <Square className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Play className="mr-1 h-3.5 w-3.5" />
              )}
              {simulating ? "Arrêter la simulation" : "Simuler les positions"}
            </Button>
          ) : null}
          {role === "TECHNICIAN" ? (
            <Button size="sm" onClick={shareGps} disabled={sharing}>
              <Crosshair className="mr-1 h-3.5 w-3.5" />
              {sharing ? "Envoi…" : "Partager ma position"}
            </Button>
          ) : null}
        </div>
      </div>
      {message ? (
        <p className="px-3 pb-2 text-xs text-muted-foreground">{message}</p>
      ) : null}
      <div className="h-[420px] w-full">
        <MapContainer
          center={SITE_CENTER}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers}
        </MapContainer>
      </div>
    </div>
  );
}

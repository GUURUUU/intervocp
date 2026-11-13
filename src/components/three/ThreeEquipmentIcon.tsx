"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Lightweight animated 3D "equipment" icon (a gear around a cylinder),
 * used in the dashboard header. Kept intentionally simple for performance.
 */

function GearShape() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.6;
      group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
    }
  });

  // Build gear teeth around a torus
  const teeth = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    return (
      <mesh
        key={i}
        position={[Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, 0]}
        rotation={[0, 0, angle]}
      >
        <boxGeometry args={[0.28, 0.42, 0.3]} />
        <meshStandardMaterial color="#2ee59d" metalness={0.6} roughness={0.25} />
      </mesh>
    );
  });

  return (
    <group ref={group}>
      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[1, 0.22, 16, 60]} />
        <meshStandardMaterial color="#0e7a4b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Teeth */}
      {teeth}
      {/* Inner hub */}
      <mesh>
        <cylinderGeometry args={[0.45, 0.45, 0.55, 32]} />
        <meshStandardMaterial color="#c9d6d1" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Hub hole */}
      <mesh position={[0, 0, 0.01]}>
        <cylinderGeometry args={[0.18, 0.18, 0.6, 24]} />
        <meshStandardMaterial color="#0b1211" metalness={0.2} roughness={0.8} />
      </mesh>
    </group>
  );
}

interface ThreeEquipmentIconProps {
  size?: number;
  className?: string;
}

export default function ThreeEquipmentIcon({
  size = 72,
  className = "",
}: ThreeEquipmentIconProps) {
  const [ready, setReady] = useState(true);

  if (!ready) {
    // Static fallback if WebGL init fails
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-3xl ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        ⚙️
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0.4, 3.4], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          if (!gl.getContext()) setReady(false);
        }}
        onError={() => setReady(false)}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 4]} intensity={1.4} />
        <directionalLight position={[-3, -2, -2]} intensity={0.4} color="#2ee59d" />
        <GearShape />
      </Canvas>
    </div>
  );
}

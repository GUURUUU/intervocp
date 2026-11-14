"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Small animated 3D "live position" pin used on the tracking page
 * header (mandated R3F map-marker accent).
 */

function PinShape() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.8;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.08;
      group.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={group}>
      {/* Pin head */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#10b981" metalness={0.5} roughness={0.25} />
      </mesh>
      {/* Pin tip (cone pointing down) */}
      <mesh position={[0, -0.35, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.32, 1.1, 24]} />
        <meshStandardMaterial color="#0e7a4b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Halo ring */}
      <mesh position={[0, -0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.06, 12, 40]} />
        <meshStandardMaterial
          color="#2ee59d"
          emissive="#2ee59d"
          emissiveIntensity={0.6}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}

interface ThreeLivePinProps {
  size?: number;
  className?: string;
}

export default function ThreeLivePin({
  size = 56,
  className = "",
}: ThreeLivePinProps) {
  const [ready, setReady] = useState(true);

  if (!ready) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-2xl ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        📍
      </div>
    );
  }

  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.3, 3.2], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          if (!gl.getContext()) setReady(false);
        }}
        onError={() => setReady(false)}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 4]} intensity={1.3} />
        <directionalLight position={[-2, -1, -3]} intensity={0.5} color="#2ee59d" />
        <PinShape />
      </Canvas>
    </div>
  );
}

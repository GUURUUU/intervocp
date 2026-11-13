"use client";

import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

interface ShaderGradientBackgroundProps {
  /** Additional wrapper classes (positioning/size). */
  className?: string;
}

/**
 * Animated shader gradient background.
 * Colors follow the OCP brand palette: industrial green, teal-gray, white.
 * Used on the login page, dashboard header and empty states.
 */
export default function ShaderGradientBackground({
  className = "",
}: ShaderGradientBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    >
      <ShaderGradientCanvas
        pixelDensity={0.7}
        fov={55}
        pointerEvents="none"
        className="!absolute inset-0"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.35}
          uStrength={1.1}
          uDensity={1.1}
          uFrequency={1.4}
          uAmplitude={0.9}
          positionX={0}
          positionY={0}
          positionZ={1.1}
          rotationX={35}
          rotationY={0}
          rotationZ={-30}
          color1="#0f3d2e"
          color2="#0e7a4b"
          color3="#d8e5e0"
          reflection={0.35}
          wireframe={false}
        />
      </ShaderGradientCanvas>
    </div>
  );
}

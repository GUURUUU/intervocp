"use client";

import { useEffect, useRef, useState } from "react";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
// Restores the `cube_uv_reflection_fragment` shader chunk removed in
// three r166 — required for @shadergradient/react to compile (r187).
import "@/lib/three-polyfills";

interface ShaderGradientBackgroundProps {
  /** Additional wrapper classes (positioning/size). */
  className?: string;
}

/**
 * Animated shader gradient background (OCP brand palette: industrial
 * green, teal-gray, white). If the WebGL shader fails or renders empty
 * (headless browsers, blocked GPU...), it transparently falls back to a
 * pure-CSS animated gradient so the layout never shows a black screen.
 */
export default function ShaderGradientBackground({
  className = "",
}: ShaderGradientBackgroundProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [shaderOk, setShaderOk] = useState<boolean | null>(null);

  // Verify the shader actually drew pixels; otherwise fall back to CSS.
  useEffect(() => {
    const timer = setTimeout(() => {
      const host = canvasRef.current;
      const canvas = host?.querySelector("canvas");
      if (!canvas) {
        setShaderOk(false);
        return;
      }
      try {
        const sample = document.createElement("canvas");
        sample.width = 32;
        sample.height = 18;
        const ctx = sample.getContext("2d");
        if (!ctx) {
          setShaderOk(false);
          return;
        }
        ctx.drawImage(canvas, 0, 0, 32, 18);
        const data = ctx.getImageData(0, 0, 32, 18).data;
        let colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          if (r + g + b > 45 && !(r < 20 && g < 20 && b < 20)) colored++;
        }
        setShaderOk(colored > 30);
      } catch {
        setShaderOk(false);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const useCssFallback = shaderOk === false;

  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      {/* CSS gradient base (always present, also the fallback layer) */}
      <div
        className={`absolute inset-0 bg-[linear-gradient(130deg,#e9f6ee_0%,#ffffff_35%,#dcefe4_65%,#eef3f6_100%)] ${
          useCssFallback ? "opacity-100" : "opacity-0"
        } transition-opacity duration-700`}
      >
        <div className="absolute -left-40 top-10 h-96 w-96 animate-pulse rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 animate-pulse rounded-full bg-teal-200/40 blur-3xl [animation-delay:1.2s]" />
      </div>

      {/* WebGL shader layer */}
      <div ref={canvasRef} className={useCssFallback ? "hidden" : "absolute inset-0"}>
        <ShaderGradientCanvas
          pixelDensity={0.7}
          fov={55}
          pointerEvents="none"
          preserveDrawingBuffer
          className="!absolute inset-0"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <ShaderGradient
            control="props"
            type="waterPlane"
            animate="on"
            uSpeed={0.4}
            uStrength={1.2}
            uDensity={1.2}
            uFrequency={1.5}
            uAmplitude={1.0}
            positionX={0}
            positionY={-0.2}
            positionZ={1.2}
            rotationX={45}
            rotationY={0}
            rotationZ={-20}
            color1="#0d5c38"
            color2="#17a163"
            color3="#e8f4ee"
            reflection={0.3}
            wireframe={false}
          />
        </ShaderGradientCanvas>
      </div>
    </div>
  );
}

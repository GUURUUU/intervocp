"use client";

import { useEffect, useState } from "react";
import { LiquidMetal } from "@paper-design/shaders-react";

interface LiquidMetalLogoProps {
  /** Width of the logo canvas in px. */
  width?: number;
  /** Height of the logo canvas in px. */
  height?: number;
  /** Extra classes. */
  className?: string;
  /** Rasterize this text into the shader-driven image. */
  text?: string;
}

/**
 * Renders the "IntervOCP" wordmark through the liquid-metal shader.
 * The text is rasterized at runtime into a canvas image and fed to
 * the @paper-design/shaders-react `LiquidMetal` component — following the
 * usage pattern of paper-design/liquid-logo without cloning it.
 */
export default function LiquidMetalLogo({
  width = 280,
  height = 72,
  className = "",
  text = "IntervOCP",
}: LiquidMetalLogoProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const scale = 2; // crisp rasterization
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setFailed(true);
        return;
      }

      ctx.scale(scale, scale);
      ctx.clearRect(0, 0, width, height);

      // White glyph on transparent background (what the shader treats as metal)
      ctx.font = `800 56px var(--font-sans, Arial, sans-serif)`;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(text, width / 2, height / 2 + 2);

      setImageUrl(canvas.toDataURL("image/png"));
    } catch {
      setFailed(true);
    }
  }, [text, width, height]);

  if (failed || !imageUrl) {
    // CSS fallback while processing or if the shader cannot run
    return (
      <span
        className={`inline-flex items-center justify-center bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent ${className}`}
        style={{ width, height }}
      >
        {text}
      </span>
    );
  }

  return (
    <LiquidMetal
      image={imageUrl}
      className={className}
      style={{ width, height }}
      fit="contain"
      scale={1.9}
      colorBack="#00000000"
      colorTint="#7dd3b0"
      distortion={0.45}
      softness={0.3}
      speed={0.8}
      contour={0.35}
      angle={45}
      shiftRed={0.08}
      shiftBlue={0.08}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button as GlassButton } from "@/lib/liquid-glass/glass-core";
import {
  ensureHtml2Canvas,
  webglSupported,
} from "@/lib/liquid-glass/bootstrap";

interface LiquidGlassButtonProps {
  label: string;
  size?: number;
  type?: "rounded" | "circle" | "pill";
  tintOpacity?: number;
  warp?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * React wrapper around the WebGL `Button` class of
 * dashersw/liquid-glass-js. Falls back to a styled native button
 * when WebGL is unavailable. Client-only by design.
 */
export default function LiquidGlassButton({
  label,
  size = 32,
  type = "pill",
  tintOpacity = 0.25,
  warp = false,
  onClick,
  className = "",
}: LiquidGlassButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<GlassButton | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      const host = hostRef.current;
      if (!host) return;

      if (!webglSupported()) {
        setFallback(true);
        return;
      }

      try {
        await ensureHtml2Canvas();
        if (cancelled || !hostRef.current) return;

        const glassBtn = new GlassButton({
          text: label,
          size,
          type,
          tintOpacity,
          warp,
          onClick: () => onClick?.(),
        });
        buttonRef.current = glassBtn;

        if (glassBtn.element) {
          glassBtn.element.classList.add("liquid-glass-host");
          host.appendChild(glassBtn.element);
          glassBtn.updateSizeFromDOM();
        }
      } catch {
        if (!cancelled) setFallback(true);
      }
    };

    void mount();

    return () => {
      cancelled = true;
      buttonRef.current?.destroy();
      buttonRef.current = null;
    };
  }, [label, size, type, tintOpacity, warp, onClick]);

  if (fallback) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-white/20 ${className}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      ref={hostRef}
      className={`relative ${className}`}
      role="button"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    />
  );
}

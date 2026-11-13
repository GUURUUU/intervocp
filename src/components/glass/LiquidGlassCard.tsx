"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/lib/liquid-glass/glass-core";
import {
  ensureHtml2Canvas,
  webglSupported,
} from "@/lib/liquid-glass/bootstrap";

interface LiquidGlassCardProps {
  /** Card content rendered above the glass surface. */
  children?: React.ReactNode;
  /** Wrapper element classes (layout, spacing, etc.). */
  className?: string;
  /** Corner radius in pixels (default 24). */
  borderRadius?: number;
  /** Shape of the glass surface. */
  type?: "rounded" | "circle" | "pill";
  /** Tint overlay opacity between 0 and 1 (default 0.18). */
  tintOpacity?: number;
  /** Extra classes applied to the content layer. */
  contentClassName?: string;
}

/**
 * React wrapper around the WebGL `Container` class of
 * dashersw/liquid-glass-js. Renders real refraction glass when WebGL is
 * available and gracefully falls back to a CSS `backdrop-filter` glass
 * otherwise. Client-only by design.
 */
export default function LiquidGlassCard({
  children,
  className = "",
  borderRadius = 24,
  type = "rounded",
  tintOpacity = 0.18,
  contentClassName = "",
}: LiquidGlassCardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<Container | null>(null);
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

        const glass = new Container({
          borderRadius,
          type,
          tintOpacity,
        });
        containerRef.current = glass;

        const el = glass.element;
        if (el) {
          el.style.position = "absolute";
          el.style.inset = "0";
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.borderRadius = "inherit";
          el.classList.add("liquid-glass-host");
          host.appendChild(el);
          glass.updateSizeFromDOM();
        }
      } catch {
        // WebGL context failure, html2canvas error, ... → CSS fallback.
        if (!cancelled) setFallback(true);
      }
    };

    void mount();

    return () => {
      cancelled = true;
      containerRef.current?.destroy();
      containerRef.current = null;
    };
  }, [borderRadius, type, tintOpacity]);

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      aria-label="surface en verre liquide"
    >
      {/* WebGL glass host (absolute, behind the content) */}
      <div
        ref={hostRef}
        aria-hidden="true"
        className="absolute inset-0 z-0 rounded-[inherit]"
      />

      {/* CSS fallback glass layer */}
      {fallback ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 rounded-[inherit] liquid-glass-fallback"
        />
      ) : null}

      {/* Content layer */}
      <div className={`relative z-10 ${contentClassName}`}>{children}</div>
    </div>
  );
}

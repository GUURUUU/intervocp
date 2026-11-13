"use client";

/**
 * Bootstrap helpers for the vendored liquid-glass-js library.
 * The library expects the global `html2canvas` to exist when capturing
 * page snapshots, so we lazily load it once from the npm dependency.
 */

let html2canvasPromise: Promise<typeof import("html2canvas").default> | null =
  null;

/** Returns true when WebGL (v1) is available in the current browser. */
export function webglSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

/** Lazily loads html2canvas and exposes it on `window` (expected by the library). */
export async function ensureHtml2Canvas(): Promise<
  typeof import("html2canvas").default
> {
  if (!html2canvasPromise) {
    html2canvasPromise = import("html2canvas").then((mod) => {
      const fn = mod.default;
      (globalThis as unknown as { html2canvas: typeof fn }).html2canvas = fn;
      return fn;
    });
  }
  return html2canvasPromise;
}

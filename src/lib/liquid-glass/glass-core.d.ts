/**
 * Type declarations for the vendored liquid-glass-js library
 * (https://github.com/dashersw/liquid-glass-js, MIT License).
 * The vendored module has been lightly patched to add `destroy()`
 * lifecycle support for React integration.
 */

export declare class Container {
  static instances: Container[];
  static pageSnapshot: HTMLCanvasElement | null;
  static isCapturing: boolean;
  static waitingForSnapshot: Container[];

  width: number;
  height: number;
  borderRadius: number;
  type: "rounded" | "circle" | "pill";
  tintOpacity: number;
  canvas: HTMLCanvasElement | null;
  element: HTMLDivElement | null;
  gl: WebGLRenderingContext | null;
  gl_refs: Record<string, unknown>;
  webglInitialized: boolean;
  children: Container[];
  parent: Container | null;
  _destroyed?: boolean;
  render?: () => void;

  constructor(options: {
    borderRadius?: number;
    type?: "rounded" | "circle" | "pill";
    tintOpacity?: number;
  });

  addChild(child: Button): Button;
  removeChild(child: Button): void;
  updateSizeFromDOM(): void;
  init(): void;
  initWebGL(): void;
  render?(): void;
  destroy(): void;
}

export declare class Button extends Container {
  constructor(options: {
    text?: string;
    size?: number;
    type?: "rounded" | "circle" | "pill";
    onClick?: ((text: string) => void) | null;
    warp?: boolean;
    tintOpacity?: number;
    borderRadius?: number;
  });

  setupAsNestedGlass(): void;
}

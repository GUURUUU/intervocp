import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Typed HTTP error used across the API layer. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Uniform JSON error response. */
export function jsonError(
  status: number,
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json({ error: message, details }, { status });
}

/**
 * Wraps an API route handler: converts ApiError / ZodError into clean
 * JSON responses, logs and masks unexpected errors.
 */
export async function handleRoute(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.status, error.message, error.details);
    }
    if (error instanceof ZodError) {
      return jsonError(400, "Données invalides", error.flatten().fieldErrors);
    }
    console.error("[api] unexpected error:", error);
    return jsonError(500, "Erreur interne du serveur");
  }
}

/** Parses a JSON body safely, throwing a 400 ApiError on failure. */
export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Corps de requête JSON invalide");
  }
}

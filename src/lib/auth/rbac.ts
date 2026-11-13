import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/api-helpers";

export type { Role };

/** Role labels in French, for the UI. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  DISPATCHER: "Répartiteur",
  TECHNICIAN: "Technicien",
  CLIENT: "Client",
  MANAGER: "Responsable",
};

/**
 * Server-side authorization guard for API routes and server actions.
 * Throws `ApiError(401/403)` when the caller is not authorized.
 *
 * @param roles Allowed roles; when omitted, any authenticated role passes.
 */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new ApiError(401, "Non authentifié");
  }
  if (roles && roles.length > 0 && !roles.includes(session.user.role)) {
    throw new ApiError(403, "Accès refusé pour ce rôle");
  }
  return session;
}

/** Returns the current session or null (no throw). */
export async function getSessionOrNull(): Promise<Session | null> {
  const session = await auth();
  return session ?? null;
}

/** True if the current user has one of the given roles. */
export async function hasRole(...roles: Role[]): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return Boolean(role && roles.includes(role));
}

/** Navbar entries per role (used by the app shell to filter links). */
export const NAV_ACCESS: Record<string, Role[]> = {
  dashboard: ["ADMIN", "DISPATCHER", "TECHNICIAN", "CLIENT", "MANAGER"],
  requests: ["ADMIN", "DISPATCHER", "TECHNICIAN", "CLIENT", "MANAGER"],
  planning: ["ADMIN", "DISPATCHER", "TECHNICIAN"],
  tracking: ["ADMIN", "DISPATCHER", "TECHNICIAN", "MANAGER"],
  stock: ["ADMIN", "DISPATCHER", "TECHNICIAN", "MANAGER"],
  reports: ["ADMIN", "DISPATCHER", "TECHNICIAN", "CLIENT", "MANAGER"],
  admin: ["ADMIN"],
};

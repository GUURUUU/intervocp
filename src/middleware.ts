import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Edge-safe middleware: guards every non-API page (see `authorized` callback).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Everything except API routes, Next internals and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  registerLoginFailure,
} from "./rate-limit";
import { authConfig } from "./config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const key = email.toLowerCase();

        // Brute-force protection: 5 failures in 15 min lock the account.
        if (!checkLoginRateLimit(key).allowed) return null;

        const user = await prisma.user.findUnique({ where: { email: key } });

        if (!user || !user.active) {
          registerLoginFailure(key);
          return null;
        }

        const valid = bcrypt.compareSync(password, user.passwordHash);
        if (!valid) {
          registerLoginFailure(key);
          return null;
        }

        clearLoginFailures(key);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});

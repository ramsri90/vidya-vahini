import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import {
  checkRateLimit,
  recordRateLimitAttempt,
  resetRateLimit,
} from "@/lib/rate-limit";

interface CachedUserStatus {
  sessionVersion: number;
  isActive: boolean;
  mustChangePassword: boolean;
  role: Role;
  expiresAt: number;
}

const userSessionCache = new Map<string, CachedUserStatus>();
const SESSION_CACHE_TTL_MS = 60 * 1000; // 60-second TTL to eliminate remote DB roundtrips on page loads

export function primeUserSessionCache(user: {
  id: string;
  sessionVersion: number;
  isActive: boolean;
  mustChangePassword: boolean;
  role: Role;
}) {
  userSessionCache.set(user.id, {
    sessionVersion: user.sessionVersion,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
  });
}

export function invalidateUserSessionCache(userId: string) {
  userSessionCache.delete(userId);
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Roll No or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.identifier as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;

        if (!identifier || !password) {
          return null;
        }

        const rateLimit = checkRateLimit(identifier);
        if (!rateLimit.allowed) {
          await writeAudit({
            action: "login.failed",
            targetType: "user",
            metadata: {
              attemptedIdentifier: identifier,
              reason: "rate_limit_exceeded",
            },
          });
          return null;
        }

        let userRecord: {
          id: string;
          name: string;
          email: string;
          role: Role;
          passwordHash: string;
          mustChangePassword: boolean;
          sessionVersion: number;
          isActive: boolean;
        } | null = null;

        let sectionId: string | null = null;

        if (identifier.includes("@")) {
          const user = await prisma.user.findUnique({
            where: { email: identifier.toLowerCase() },
            include: { student: true },
          });

          if (user) {
            userRecord = user;
            sectionId = user.student?.sectionId ?? null;
          }
        } else {
          // Look up by student roll_no
          const student = await prisma.student.findUnique({
            where: { rollNo: identifier },
            include: { user: true },
          });

          if (student && student.user) {
            userRecord = student.user;
            sectionId = student.sectionId;
          } else {
            // Fallback to email lookup if identifier didn't match roll_no
            const user = await prisma.user.findUnique({
              where: { email: identifier.toLowerCase() },
              include: { student: true },
            });
            if (user) {
              userRecord = user;
              sectionId = user.student?.sectionId ?? null;
            }
          }
        }

        // Unknown identifier
        if (!userRecord) {
          recordRateLimitAttempt(identifier);
          await writeAudit({
            action: "login.failed",
            targetType: "user",
            metadata: { attemptedIdentifier: identifier },
          });
          return null;
        }

        // Inactive account
        if (!userRecord.isActive) {
          recordRateLimitAttempt(identifier);
          await writeAudit({
            actorId: userRecord.id,
            action: "login.failed",
            targetType: "user",
            targetId: userRecord.id,
            metadata: { attemptedIdentifier: identifier, reason: "inactive" },
          });
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(password, userRecord.passwordHash);

        if (!isValid) {
          recordRateLimitAttempt(identifier);
          await writeAudit({
            actorId: userRecord.id,
            action: "login.failed",
            targetType: "user",
            targetId: userRecord.id,
            metadata: { attemptedIdentifier: identifier },
          });
          return null;
        }

        // Login success - clear rate limit counter
        resetRateLimit(identifier);

        // Pre-warm the session validity cache so post-login navigation is instantaneous (0 DB calls)
        primeUserSessionCache({
          id: userRecord.id,
          sessionVersion: userRecord.sessionVersion,
          isActive: userRecord.isActive,
          mustChangePassword: userRecord.mustChangePassword,
          role: userRecord.role,
        });

        return {
          id: userRecord.id,
          name: userRecord.name,
          email: userRecord.email,
          role: userRecord.role,
          mustChangePassword: userRecord.mustChangePassword,
          sessionVersion: userRecord.sessionVersion,
          sectionId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
        token.sessionVersion = user.sessionVersion;
        token.sectionId = user.sectionId ?? null;
        primeUserSessionCache({
          id: user.id,
          sessionVersion: user.sessionVersion,
          isActive: true,
          mustChangePassword: user.mustChangePassword,
          role: user.role,
        });
        return token;
      }

      // Check session validity in Node.js runtime using in-memory TTL cache to eliminate remote DB latency
      if (token.userId) {
        const userId = token.userId as string;
        const now = Date.now();
        const cached = userSessionCache.get(userId);

        let status: {
          sessionVersion: number;
          isActive: boolean;
          mustChangePassword: boolean;
          role: Role;
        } | null = null;

        if (cached && cached.expiresAt > now) {
          status = cached;
        } else {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                sessionVersion: true,
                isActive: true,
                mustChangePassword: true,
                role: true,
              },
            });

            if (dbUser) {
              status = dbUser;
              userSessionCache.set(userId, {
                ...dbUser,
                expiresAt: now + SESSION_CACHE_TTL_MS,
              });
            }
          } catch (error) {
            console.error("JWT validation error in jwt callback:", error);
            return null;
          }
        }

        if (
          !status ||
          !status.isActive ||
          status.sessionVersion !== token.sessionVersion
        ) {
          userSessionCache.delete(userId);
          // Session invalidated
          return null;
        }

        token.mustChangePassword = status.mustChangePassword;
        token.role = status.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as Role;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.sessionVersion = token.sessionVersion as number;
        session.user.sectionId = (token.sectionId as string | null) ?? null;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};

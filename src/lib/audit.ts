import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface WriteAuditParams {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "token",
  "secret",
  "authsecret",
  "auth_secret",
  "accesstoken",
  "refreshtoken",
]);

export function sanitizeMetadata(
  meta: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | undefined {
  if (!meta || typeof meta !== "object") return undefined;

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
    if (FORBIDDEN_KEYS.has(normalizedKey)) {
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      cleaned[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as Prisma.InputJsonValue;
}

export async function writeAudit({
  actorId,
  action,
  targetType,
  targetId,
  metadata,
}: WriteAuditParams) {
  try {
    const sanitizedMeta = sanitizeMetadata(metadata);

    return await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        metadata: sanitizedMeta ?? Prisma.DbNull,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Audit failures should not crash the request, but log for visibility
    return null;
  }
}

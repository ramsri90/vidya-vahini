"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { deleteObject } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export type ModerationActionResult = {
  success?: boolean;
  error?: string;
};

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // revalidatePath only runs in active Next.js request lifecycle
  }
}

/**
 * Super Admin Action: Moderation Archive
 * Archives a resource with a mandatory reason.
 */
export async function archiveResource(formData: FormData): Promise<ModerationActionResult> {
  const user = await requireRole("super_admin");

  const resourceId = formData.get("resourceId") as string | null;
  const reason = (formData.get("reason") as string | null)?.trim();

  if (!resourceId) {
    return { error: "Resource ID is required." };
  }

  if (!reason || reason.length < 3) {
    return { error: "A valid archive reason (at least 3 characters) is required." };
  }

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource) {
    return { error: "Resource not found." };
  }

  await prisma.resource.update({
    where: { id: resourceId },
    data: { archived: true },
  });

  await writeAudit({
    actorId: user.id,
    action: "moderation.archive",
    targetType: "resource",
    targetId: resourceId,
    metadata: {
      resourceId,
      reason,
      title: resource.title,
    },
  });

  safeRevalidate("/admin/resources");
  safeRevalidate("/admin/storage");
  return { success: true };
}

/**
 * Super Admin Action: Moderation Hard Delete
 * Hard delete is permitted ONLY if status = "failed" OR already archived.
 * Deletes the B2 storage object FIRST, then deletes the database row.
 * If storage delete fails, keeps the DB row and returns an error.
 */
export async function deleteResourceModeration(formData: FormData): Promise<ModerationActionResult> {
  const user = await requireRole("super_admin");

  const resourceId = formData.get("resourceId") as string | null;
  if (!resourceId) {
    return { error: "Resource ID is required." };
  }

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource) {
    return { error: "Resource not found." };
  }

  // Hard delete condition: status must be "failed" OR resource must be archived
  const isEligible = resource.status === "failed" || resource.archived === true;
  if (!isEligible) {
    return {
      error:
        "Hard delete is strictly permitted only for resources with status 'failed' or that have already been archived.",
    };
  }

  // 1. Delete B2 object first
  try {
    await deleteObject(resource.r2Key);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Storage deletion failed";
    console.error("Storage delete failed in deleteResourceModeration:", err);
    return {
      error: `Failed to delete file from storage (${errorMsg}). Database record has been retained.`,
    };
  }

  // 2. Delete DB row after verified storage deletion
  await prisma.resource.delete({
    where: { id: resourceId },
  });

  // 3. Audit log
  await writeAudit({
    actorId: user.id,
    action: "moderation.delete",
    targetType: "resource",
    targetId: resourceId,
    metadata: {
      resourceId,
      status: resource.status,
    },
  });

  safeRevalidate("/admin/resources");
  safeRevalidate("/admin/storage");
  return { success: true };
}

"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type RolloverActionResult = {
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
 * Super Admin Action: Archive Single Section
 */
export async function archiveSingleSection(formData: FormData): Promise<RolloverActionResult> {
  const user = await requireRole("super_admin");

  const sectionId = formData.get("sectionId") as string | null;
  if (!sectionId) {
    return { error: "Section ID is required." };
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
  });

  if (!section) {
    return { error: "Section not found." };
  }

  await prisma.section.update({
    where: { id: sectionId },
    data: { isArchived: true },
  });

  await writeAudit({
    actorId: user.id,
    action: "section.archive",
    targetType: "section",
    targetId: sectionId,
    metadata: {
      sectionId,
      name: section.name,
    },
  });

  safeRevalidate("/admin/rollover");
  safeRevalidate("/admin/sections");
  safeRevalidate("/admin/storage");
  return { success: true };
}

/**
 * Super Admin Action: Run Semester Rollover for Multiple Sections
 */
export async function rolloverRun(formData: FormData): Promise<RolloverActionResult> {
  const user = await requireRole("super_admin");

  const sectionIdsRaw = formData.get("sectionIds") as string | null;
  if (!sectionIdsRaw) {
    return { error: "No sections selected for rollover." };
  }

  let sectionIds: string[] = [];
  try {
    sectionIds = JSON.parse(sectionIdsRaw);
  } catch {
    sectionIds = sectionIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  if (sectionIds.length === 0) {
    return { error: "No valid section IDs provided." };
  }

  const sectionsToArchive = await prisma.section.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true, name: true },
  });

  if (sectionsToArchive.length === 0) {
    return { error: "No matching sections found to archive." };
  }

  await prisma.section.updateMany({
    where: { id: { in: sectionsToArchive.map((s) => s.id) } },
    data: { isArchived: true },
  });

  await writeAudit({
    actorId: user.id,
    action: "rollover.run",
    targetType: "section",
    metadata: {
      sectionIds: sectionsToArchive.map((s) => s.id),
      count: sectionsToArchive.length,
    },
  });

  safeRevalidate("/admin/rollover");
  safeRevalidate("/admin/sections");
  safeRevalidate("/admin/storage");
  return { success: true };
}

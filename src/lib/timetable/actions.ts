"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { parseExcelBuffer } from "./excel";
import { ParsedSlot, ParseResult } from "./types";
import { revalidatePath } from "next/cache";
import { createDownloadUrl, deleteObject } from "@/lib/storage";

export type ActionResult<T = unknown> = {
  success?: boolean;
  error?: string;
  data?: T;
};

function safeRevalidate(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // safe fallback
    }
  }
}

// 1. Server action to parse uploaded Excel file
export async function parseTimetableFileAction(formData: FormData): Promise<ActionResult<ParseResult>> {
  await requireRole("super_admin");

  const file = formData.get("file") as File | null;
  if (!file) {
    return { error: "No Excel file provided." };
  }

  const filename = file.name.toLowerCase();
  if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
    return { error: "Invalid file format. Please upload an Excel (.xlsx) file." };
  }

  // 10 MB maximum
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File size exceeds 10 MB limit." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = parseExcelBuffer(Buffer.from(arrayBuffer));
    return { success: true, data: result };
  } catch (err: unknown) {
    console.error("Failed to parse timetable Excel:", err);
    return { error: "Failed to parse the Excel file. Please ensure it follows the template format." };
  }
}

// 2. Save Timetable with slots
export async function saveTimetableAction(input: {
  timetableId?: string;
  sectionId: string;
  academicYear: string;
  department?: string;
  effectiveFrom?: string;
  effectiveTill?: string;
  status: "draft" | "published" | "archived";
  attachmentKey?: string | null;
  attachmentName?: string | null;
  slots: ParsedSlot[];
}): Promise<ActionResult<{ timetableId: string }>> {
  const admin = await requireRole("super_admin");

  if (!input.sectionId) {
    return { error: "Please select a Section." };
  }

  if (!input.academicYear) {
    return { error: "Please provide an Academic Year." };
  }

  try {
    const section = await prisma.section.findUnique({
      where: { id: input.sectionId },
    });
    if (!section) {
      return { error: "Section not found." };
    }

    let targetId = input.timetableId;

    if (targetId) {
      // Updating existing timetable
      const existing = await prisma.timetable.findUnique({
        where: { id: targetId },
        include: { slots: true },
      });
      if (!existing) {
        return { error: "Timetable record not found." };
      }

      // If changing to published, archive any other published timetable for this section
      if (input.status === "published" && existing.status !== "published") {
        await prisma.timetable.updateMany({
          where: {
            sectionId: input.sectionId,
            status: "published",
            id: { not: targetId },
          },
          data: { status: "archived" },
        });
      }

      await prisma.$transaction(async (tx) => {
        // Delete old slots and re-insert
        await tx.timetableSlot.deleteMany({
          where: { timetableId: targetId },
        });

        await tx.timetable.update({
          where: { id: targetId },
          data: {
            academicYear: input.academicYear,
            department: input.department ?? "Computer Science & Engineering",
            effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
            effectiveTill: input.effectiveTill ? new Date(input.effectiveTill) : null,
            status: input.status,
            attachmentKey: input.attachmentKey ?? existing.attachmentKey,
            attachmentName: input.attachmentName ?? existing.attachmentName,
            slots: {
              create: input.slots.map((s, idx) => ({
                day: s.day,
                startTime: s.startTime,
                endTime: s.endTime,
                subjectCode: s.subjectCode,
                subjectName: s.subjectName,
                facultyName: s.facultyName || null,
                roomNumber: s.roomNumber || null,
                sessionType: s.sessionType,
                sectionName: s.sectionName || section.name,
                sortOrder: s.sortOrder ?? idx,
              })),
            },
          },
        });
      });

      await writeAudit({
        actorId: admin.id,
        action: "timetable.updated",
        targetType: "timetable",
        targetId,
        metadata: {
          sectionId: input.sectionId,
          slotCount: input.slots.length,
          status: input.status,
        },
      });
    } else {
      // Creating new timetable
      // If publishing, archive previous published timetable for this section
      let newVersion = 1;
      const latest = await prisma.timetable.findFirst({
        where: { sectionId: input.sectionId },
        orderBy: { version: "desc" },
      });
      if (latest) {
        newVersion = latest.version + 1;
      }

      if (input.status === "published") {
        await prisma.timetable.updateMany({
          where: {
            sectionId: input.sectionId,
            status: "published",
          },
          data: { status: "archived" },
        });
      }

      const created = await prisma.timetable.create({
        data: {
          sectionId: input.sectionId,
          academicYear: input.academicYear,
          department: input.department ?? "Computer Science & Engineering",
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
          effectiveTill: input.effectiveTill ? new Date(input.effectiveTill) : null,
          status: input.status,
          version: newVersion,
          attachmentKey: input.attachmentKey || null,
          attachmentName: input.attachmentName || null,
          createdById: admin.id,
          slots: {
            create: input.slots.map((s, idx) => ({
              day: s.day,
              startTime: s.startTime,
              endTime: s.endTime,
              subjectCode: s.subjectCode,
              subjectName: s.subjectName,
              facultyName: s.facultyName || null,
              roomNumber: s.roomNumber || null,
              sessionType: s.sessionType,
              sectionName: s.sectionName || section.name,
              sortOrder: s.sortOrder ?? idx,
            })),
          },
        },
      });

      targetId = created.id;

      await writeAudit({
        actorId: admin.id,
        action: "timetable.created",
        targetType: "timetable",
        targetId: created.id,
        metadata: {
          sectionId: input.sectionId,
          slotCount: input.slots.length,
          version: newVersion,
          status: input.status,
        },
      });
    }

    safeRevalidate(["/admin/timetable", "/student", "/student/timetable", "/faculty/timetable"]);
    return { success: true, data: { timetableId: targetId } };
  } catch (err: unknown) {
    console.error("Failed to save timetable:", err);
    return { error: "Failed to save timetable. Please check database connectivity and constraints." };
  }
}

// 3. Publish Timetable
export async function publishTimetableAction(timetableId: string): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const timetable = await prisma.timetable.findUnique({
    where: { id: timetableId },
  });
  if (!timetable) return { error: "Timetable not found." };

  try {
    // Archive other published ones for this section
    await prisma.timetable.updateMany({
      where: {
        sectionId: timetable.sectionId,
        status: "published",
        id: { not: timetableId },
      },
      data: { status: "archived" },
    });

    await prisma.timetable.update({
      where: { id: timetableId },
      data: { status: "published" },
    });

    await writeAudit({
      actorId: admin.id,
      action: "timetable.published",
      targetType: "timetable",
      targetId: timetableId,
      metadata: { sectionId: timetable.sectionId },
    });

    safeRevalidate(["/admin/timetable", "/student", "/student/timetable", "/faculty/timetable"]);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to publish timetable:", err);
    return { error: "Failed to publish timetable." };
  }
}

// 4. Unpublish Timetable (move to draft)
export async function unpublishTimetableAction(timetableId: string): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  try {
    await prisma.timetable.update({
      where: { id: timetableId },
      data: { status: "draft" },
    });

    await writeAudit({
      actorId: admin.id,
      action: "timetable.unpublished",
      targetType: "timetable",
      targetId: timetableId,
    });

    safeRevalidate(["/admin/timetable", "/student", "/student/timetable", "/faculty/timetable"]);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to unpublish timetable:", err);
    return { error: "Failed to unpublish timetable." };
  }
}

// 5. Archive Timetable
export async function archiveTimetableAction(timetableId: string): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  try {
    await prisma.timetable.update({
      where: { id: timetableId },
      data: { status: "archived" },
    });

    await writeAudit({
      actorId: admin.id,
      action: "timetable.archived",
      targetType: "timetable",
      targetId: timetableId,
    });

    safeRevalidate(["/admin/timetable", "/student", "/student/timetable", "/faculty/timetable"]);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to archive timetable:", err);
    return { error: "Failed to archive timetable." };
  }
}

// 6. Delete Timetable
export async function deleteTimetableAction(timetableId: string): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  try {
    const timetable = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    if (!timetable) return { error: "Timetable not found." };

    if (timetable.attachmentKey) {
      try {
        await deleteObject(timetable.attachmentKey);
      } catch (e) {
        console.warn("Could not delete attachment file from storage:", e);
      }
    }

    await prisma.timetable.delete({
      where: { id: timetableId },
    });

    await writeAudit({
      actorId: admin.id,
      action: "timetable.deleted",
      targetType: "timetable",
      targetId: timetableId,
    });

    safeRevalidate(["/admin/timetable", "/student", "/student/timetable", "/faculty/timetable"]);
    return { success: true };
  } catch (err: unknown) {
    console.error("Failed to delete timetable:", err);
    return { error: "Failed to delete timetable." };
  }
}

// 7. Get Presigned Download URL for Attachment
export async function getTimetableDownloadUrlAction(timetableId: string): Promise<ActionResult<{ url: string; filename: string }>> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  const timetable = await prisma.timetable.findUnique({
    where: { id: timetableId },
  });

  if (!timetable || !timetable.attachmentKey) {
    return { error: "No official document attachment found for this timetable." };
  }

  // Authorization check
  if (user.role === "student") {
    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (!student || student.sectionId !== timetable.sectionId) {
      return { error: "Forbidden: You cannot access timetable attachments for other sections." };
    }
  }

  try {
    const url = await createDownloadUrl(timetable.attachmentKey, 600);
    return {
      success: true,
      data: {
        url,
        filename: timetable.attachmentName || "official_timetable.pdf",
      },
    };
  } catch (err: unknown) {
    console.error("Failed to generate download URL:", err);
    return { error: "Failed to generate download link. Please verify cloud storage configuration." };
  }
}

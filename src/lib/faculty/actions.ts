"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import {
  replaceResourceSchema,
  deleteResourceSchema,
  createAnnouncementSchema,
  updateFacultyProfileSchema,
} from "@/lib/validations";
import { deleteObject } from "@/lib/storage";
import { revalidatePath } from "next/cache";

export type FacultyActionResult<T = unknown> = {
  success?: boolean;
  error?: string;
  data?: T;
};

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // revalidatePath only runs in active Next.js request lifecycle
  }
}

// ==========================================
// 1. RESOURCE REPLACEMENT
// ==========================================

export async function replaceResource(formData: FormData): Promise<FacultyActionResult> {
  const user = await requireRole("faculty");

  const raw = {
    oldResourceId: formData.get("oldResourceId"),
    newResourceId: formData.get("newResourceId"),
  };

  const validation = replaceResourceSchema.safeParse(raw);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid replacement parameters" };
  }

  const { oldResourceId, newResourceId } = validation.data;

  const [oldResource, newResource] = await Promise.all([
    prisma.resource.findUnique({
      where: { id: oldResourceId },
      include: {
        component: {
          include: {
            classSubject: {
              include: { section: true },
            },
          },
        },
      },
    }),
    prisma.resource.findUnique({
      where: { id: newResourceId },
      include: {
        component: {
          include: {
            classSubject: {
              include: { section: true },
            },
          },
        },
      },
    }),
  ]);

  if (!oldResource || !newResource) {
    return { error: "Resource not found." };
  }

  // Check if either section is archived
  if (
    oldResource.component.classSubject.section.isArchived ||
    newResource.component.classSubject.section.isArchived
  ) {
    return { error: "Forbidden: Section is archived and read-only." };
  }

  // Ownership verification
  const ownsOld =
    oldResource.uploadedBy === user.id || oldResource.component.facultyId === user.id;
  const ownsNew =
    newResource.uploadedBy === user.id || newResource.component.facultyId === user.id;

  if (!ownsOld || !ownsNew) {
    return { error: "Forbidden: You do not own these resources." };
  }

  if (newResource.status !== "ready") {
    return { error: "New resource must be uploaded and verified before replacing." };
  }

  // Mark old resource archived in DB first so it is hidden immediately
  await prisma.resource.update({
    where: { id: oldResourceId },
    data: { archived: true },
  });

  // Delete old object from storage
  try {
    await deleteObject(oldResource.r2Key);
  } catch (err) {
    console.error("Failed to delete old object from storage during replacement:", err);
    // Old DB row is already marked archived=true, preserving consistency
  }

  await writeAudit({
    actorId: user.id,
    action: "resource.replace",
    targetType: "resource",
    targetId: newResourceId,
    metadata: {
      oldResourceId,
      componentId: newResource.componentId,
      category: newResource.category,
    },
  });

  safeRevalidate(`/faculty/components/${newResource.componentId}`);
  return { success: true };
}

// ==========================================
// 2. RESOURCE DELETION
// ==========================================

export async function deleteOwnResource(formData: FormData): Promise<FacultyActionResult> {
  const user = await requireRole("faculty");

  const raw = { resourceId: formData.get("resourceId") };
  const validation = deleteResourceSchema.safeParse(raw);
  if (!validation.success) {
    return { error: "Invalid resource ID." };
  }

  const { resourceId } = validation.data;

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      component: {
        include: {
          classSubject: {
            include: { section: true },
          },
        },
      },
    },
  });

  if (!resource) {
    return { error: "Resource not found." };
  }

  // Check if section is archived
  if (resource.component.classSubject.section.isArchived) {
    return { error: "Forbidden: Section is archived and read-only." };
  }

  // Verify ownership: user must have uploaded it or be assigned faculty
  const isOwner =
    resource.uploadedBy === user.id || resource.component.facultyId === user.id;

  if (!isOwner) {
    return { error: "Forbidden: You cannot delete another faculty's resource." };
  }

  // Delete storage object first. If storage delete fails, DO NOT delete DB row!
  try {
    await deleteObject(resource.r2Key);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Storage delete failure";
    return {
      error: `Failed to delete file from storage (${message}). Database record has been retained.`,
    };
  }

  // Delete DB row after successful storage deletion
  await prisma.resource.delete({
    where: { id: resourceId },
  });

  await writeAudit({
    actorId: user.id,
    action: "resource.delete",
    targetType: "resource",
    targetId: resourceId,
    metadata: {
      componentId: resource.componentId,
      category: resource.category,
      title: resource.title,
    },
  });

  safeRevalidate(`/faculty/components/${resource.componentId}`);
  return { success: true };
}

// ==========================================
// 3. ANNOUNCEMENTS
// ==========================================

export async function createAnnouncement(formData: FormData): Promise<FacultyActionResult> {
  const user = await requireRole("faculty");

  const raw = {
    componentId: formData.get("componentId"),
    message: formData.get("message"),
  };

  const validation = createAnnouncementSchema.safeParse(raw);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid announcement message" };
  }

  const { componentId, message } = validation.data;

  const component = await prisma.component.findUnique({
    where: { id: componentId },
  });

  if (!component) {
    return { error: "Component not found." };
  }

  if (component.facultyId !== user.id) {
    return { error: "Forbidden: You can only post announcements to your assigned components." };
  }

  const announcement = await prisma.announcement.create({
    data: {
      componentId,
      postedBy: user.id,
      message,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "announcement.create",
    targetType: "announcement",
    targetId: announcement.id,
    metadata: {
      componentId,
    },
  });

  safeRevalidate(`/faculty/components/${componentId}`);
  return { success: true };
}

// ==========================================
// 4. FACULTY PROFILE
// ==========================================

export async function updateFacultyProfile(
  formData: FormData
): Promise<FacultyActionResult<{ email: string; phone: string | null }>> {
  const user = await requireRole("faculty");

  const raw = {
    email: formData.get("email"),
    phone: formData.get("phone"),
  };

  const validation = updateFacultyProfileSchema.safeParse(raw);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid profile data" };
  }

  const { email, phone } = validation.data;

  // Check unique email across other users
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      id: { not: user.id },
    },
  });

  if (existingUser) {
    return { error: `Email "${email}" is already used by another account.` };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      phone: phone || null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "faculty.profile_update",
    targetType: "user",
    targetId: user.id,
    metadata: {
      email,
      phone: phone || null,
    },
  });

  safeRevalidate("/faculty/profile");
  return {
    success: true,
    data: { email: updated.email, phone: updated.phone },
  };
}

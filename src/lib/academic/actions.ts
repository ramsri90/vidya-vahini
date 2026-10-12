"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import {
  sectionSchema,
  updateSectionSchema,
  toggleSectionArchiveSchema,
  subjectSchema,
  updateSubjectSchema,
  classSubjectSchema,
  toggleClassSubjectActiveSchema,
  assignComponentSchema,
  removeComponentSchema,
} from "@/lib/validations";
import { ComponentType, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { deleteObject } from "@/lib/storage";

export type ActionResult<T = unknown> = {
  success?: boolean;
  error?: string;
  data?: T;
};

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // revalidatePath only works inside active Next.js request lifecycle
  }
}

// ==========================================
// SECTIONS
// ==========================================

export async function createSection(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    name: formData.get("name"),
    year: formData.get("year"),
    semester: formData.get("semester"),
  };

  const validation = sectionSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid section data" };
  }

  const { name, year, semester } = validation.data;

  try {
    const existing = await prisma.section.findUnique({
      where: {
        name_year_semester: {
          name,
          year,
          semester,
        },
      },
    });

    if (existing) {
      return {
        error: `Section "${name}" for Year ${year}, Semester ${semester} already exists.`,
      };
    }

    const section = await prisma.section.create({
      data: {
        name,
        year,
        semester,
      },
    });

    await writeAudit({
      actorId: admin.id,
      action: "section.create",
      targetType: "section",
      targetId: section.id,
      metadata: { name, year, semester },
    });

    safeRevalidate("/admin/sections");
    safeRevalidate("/admin/class-subjects");
    return { success: true, data: section };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        error: `Section "${name}" for Year ${year}, Semester ${semester} already exists.`,
      };
    }
    console.error("createSection error:", error);
    return { error: "Failed to create section" };
  }
}

export async function updateSection(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    id: formData.get("id"),
    name: formData.get("name"),
    year: formData.get("year"),
    semester: formData.get("semester"),
  };

  const validation = updateSectionSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid section data" };
  }

  const { id, name, year, semester } = validation.data;

  try {
    const conflict = await prisma.section.findFirst({
      where: {
        name,
        year,
        semester,
        NOT: { id },
      },
    });

    if (conflict) {
      return {
        error: `Another section with name "${name}", Year ${year}, Semester ${semester} already exists.`,
      };
    }

    const section = await prisma.section.update({
      where: { id },
      data: { name, year, semester },
    });

    await writeAudit({
      actorId: admin.id,
      action: "section.update",
      targetType: "section",
      targetId: section.id,
      metadata: { name, year, semester },
    });

    safeRevalidate("/admin/sections");
    safeRevalidate("/admin/class-subjects");
    return { success: true, data: section };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        error: `Another section with name "${name}", Year ${year}, Semester ${semester} already exists.`,
      };
    }
    console.error("updateSection error:", error);
    return { error: "Failed to update section" };
  }
}

export async function toggleSectionArchive(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    id: formData.get("id"),
    isArchived: formData.get("isArchived") === "true",
  };

  const validation = toggleSectionArchiveSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: "Invalid section archive payload" };
  }

  const { id, isArchived } = validation.data;

  try {
    const section = await prisma.section.update({
      where: { id },
      data: { isArchived },
    });

    await writeAudit({
      actorId: admin.id,
      action: "section.archive_toggle",
      targetType: "section",
      targetId: section.id,
      metadata: { isArchived },
    });

    safeRevalidate("/admin/sections");
    safeRevalidate("/admin/class-subjects");
    return { success: true, data: section };
  } catch (error) {
    console.error("toggleSectionArchive error:", error);
    return { error: "Failed to update section archive status" };
  }
}

// ==========================================
// SUBJECTS
// ==========================================

export async function createSubject(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    code: formData.get("code"),
    name: formData.get("name"),
    year: formData.get("year"),
    semester: formData.get("semester"),
  };

  const validation = subjectSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid subject data" };
  }

  const { code, name, year, semester } = validation.data;

  try {
    const existing = await prisma.subject.findUnique({
      where: { code },
    });

    if (existing) {
      return { error: `A subject with code "${code}" already exists.` };
    }

    const subject = await prisma.subject.create({
      data: { code, name, year, semester },
    });

    await writeAudit({
      actorId: admin.id,
      action: "subject.create",
      targetType: "subject",
      targetId: subject.id,
      metadata: { code, name, year, semester },
    });

    safeRevalidate("/admin/subjects");
    safeRevalidate("/admin/class-subjects");
    return { success: true, data: subject };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `A subject with code "${code}" already exists.` };
    }
    console.error("createSubject error:", error);
    return { error: "Failed to create subject" };
  }
}

export async function updateSubject(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    id: formData.get("id"),
    code: formData.get("code"),
    name: formData.get("name"),
    year: formData.get("year"),
    semester: formData.get("semester"),
  };

  const validation = updateSubjectSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid subject data" };
  }

  const { id, code, name, year, semester } = validation.data;

  try {
    const conflict = await prisma.subject.findFirst({
      where: {
        code,
        NOT: { id },
      },
    });

    if (conflict) {
      return { error: `Another subject with code "${code}" already exists.` };
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: { code, name, year, semester },
    });

    await writeAudit({
      actorId: admin.id,
      action: "subject.update",
      targetType: "subject",
      targetId: subject.id,
      metadata: { code, name, year, semester },
    });

    safeRevalidate("/admin/subjects");
    safeRevalidate("/admin/class-subjects");
    return { success: true, data: subject };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `Another subject with code "${code}" already exists.` };
    }
    console.error("updateSubject error:", error);
    return { error: "Failed to update subject" };
  }
}

// ==========================================
// CLASS-SUBJECTS (Linking Section to Subject)
// ==========================================

export async function linkClassSubject(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    sectionId: formData.get("sectionId"),
    subjectId: formData.get("subjectId"),
  };

  const validation = classSubjectSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid class-subject link data" };
  }

  const { sectionId, subjectId } = validation.data;

  try {
    const existing = await prisma.classSubject.findUnique({
      where: {
        sectionId_subjectId: {
          sectionId,
          subjectId,
        },
      },
    });

    if (existing) {
      return { error: "This subject is already linked to the selected section." };
    }

    const classSubject = await prisma.classSubject.create({
      data: {
        sectionId,
        subjectId,
        isActive: true,
      },
      include: {
        section: true,
        subject: true,
      },
    });

    await writeAudit({
      actorId: admin.id,
      action: "class_subject.create",
      targetType: "class_subject",
      targetId: classSubject.id,
      metadata: {
        sectionId,
        subjectId,
        sectionName: classSubject.section.name,
        subjectCode: classSubject.subject.code,
      },
    });

    safeRevalidate("/admin/class-subjects");
    safeRevalidate("/admin/sections");
    safeRevalidate("/admin/subjects");
    return { success: true, data: classSubject };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This subject is already linked to the selected section." };
    }
    console.error("linkClassSubject error:", error);
    return { error: "Failed to link subject to section" };
  }
}

export async function toggleClassSubjectActive(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    id: formData.get("id"),
    isActive: formData.get("isActive") === "true",
  };

  const validation = toggleClassSubjectActiveSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: "Invalid class-subject payload" };
  }

  const { id, isActive } = validation.data;

  try {
    const classSubject = await prisma.classSubject.update({
      where: { id },
      data: { isActive },
    });

    await writeAudit({
      actorId: admin.id,
      action: "class_subject.active_toggle",
      targetType: "class_subject",
      targetId: classSubject.id,
      metadata: { isActive },
    });

    safeRevalidate("/admin/class-subjects");
    return { success: true, data: classSubject };
  } catch (error) {
    console.error("toggleClassSubjectActive error:", error);
    return { error: "Failed to update class-subject status" };
  }
}

// ==========================================
// COMPONENT ASSIGNMENT
// ==========================================

export async function assignComponent(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    classSubjectId: formData.get("classSubjectId"),
    type: formData.get("type"),
    facultyId: formData.get("facultyId"),
  };

  const validation = assignComponentSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid component assignment" };
  }

  const { classSubjectId, type, facultyId } = validation.data;

  // Rule 4: Component faculty validation:
  // confirm user exists, has role = faculty, and is_active = true
  const facultyUser = await prisma.user.findUnique({
    where: { id: facultyId },
  });

  if (!facultyUser || facultyUser.role !== "faculty" || !facultyUser.isActive) {
    return {
      error: "Selected user is invalid, inactive, or not a faculty member.",
    };
  }

  try {
    // Upsert semantics: assigning again replaces faculty_id
    const component = await prisma.component.upsert({
      where: {
        classSubjectId_type: {
          classSubjectId,
          type: type as ComponentType,
        },
      },
      update: {
        facultyId,
      },
      create: {
        classSubjectId,
        type: type as ComponentType,
        facultyId,
      },
      include: {
        faculty: true,
        classSubject: {
          include: {
            section: true,
            subject: true,
          },
        },
      },
    });

    await writeAudit({
      actorId: admin.id,
      action: "component.assign",
      targetType: "component",
      targetId: component.id,
      metadata: {
        classSubjectId,
        type,
        facultyId,
        facultyName: component.faculty.name,
        sectionName: component.classSubject.section.name,
        subjectCode: component.classSubject.subject.code,
      },
    });

    safeRevalidate("/admin");
    safeRevalidate("/admin/class-subjects");
    return { success: true, data: component };
  } catch (error) {
    console.error("assignComponent error:", error);
    return { error: "Failed to assign component faculty" };
  }
}

export async function assignFacultyToSectionSubject(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const sectionId = formData.get("sectionId") as string;
  const subjectId = formData.get("subjectId") as string;
  const type = formData.get("type") as string;
  const facultyId = formData.get("facultyId") as string;

  if (!sectionId || !subjectId || !type || !facultyId) {
    return { error: "All fields are required (Section, Subject, Type, and Faculty)." };
  }

  if (type !== "theory" && type !== "lab") {
    return { error: 'Invalid component type: must be "theory" or "lab".' };
  }

  const facultyUser = await prisma.user.findUnique({
    where: { id: facultyId },
  });

  if (!facultyUser || facultyUser.role !== "faculty" || !facultyUser.isActive) {
    return {
      error: "Selected user is invalid, inactive, or not a faculty member.",
    };
  }

  try {
    // 1. Find or create classSubject
    let classSubject = await prisma.classSubject.findUnique({
      where: {
        sectionId_subjectId: {
          sectionId,
          subjectId,
        },
      },
      include: {
        section: true,
        subject: true,
      },
    });

    if (!classSubject) {
      classSubject = await prisma.classSubject.create({
        data: {
          sectionId,
          subjectId,
          isActive: true,
        },
        include: {
          section: true,
          subject: true,
        },
      });

      await writeAudit({
        actorId: admin.id,
        action: "class_subject.create",
        targetType: "class_subject",
        targetId: classSubject.id,
        metadata: {
          sectionId,
          subjectId,
          sectionName: classSubject.section.name,
          subjectCode: classSubject.subject.code,
        },
      });
    }

    // 2. Upsert component for classSubject
    const component = await prisma.component.upsert({
      where: {
        classSubjectId_type: {
          classSubjectId: classSubject.id,
          type: type as ComponentType,
        },
      },
      update: {
        facultyId,
      },
      create: {
        classSubjectId: classSubject.id,
        type: type as ComponentType,
        facultyId,
      },
      include: {
        faculty: true,
      },
    });

    await writeAudit({
      actorId: admin.id,
      action: "component.assign",
      targetType: "component",
      targetId: component.id,
      metadata: {
        classSubjectId: classSubject.id,
        type,
        facultyId,
        facultyName: component.faculty.name,
        sectionName: classSubject.section.name,
        subjectCode: classSubject.subject.code,
      },
    });

    safeRevalidate("/admin");
    safeRevalidate("/admin/class-subjects");
    return {
      success: true,
      data: {
        component,
        facultyName: component.faculty.name,
        sectionName: classSubject.section.name,
        subjectName: classSubject.subject.name,
        type,
      },
    };
  } catch (error) {
    console.error("assignFacultyToSectionSubject error:", error);
    return { error: "Failed to assign faculty to section subject." };
  }
}

export async function removeComponent(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");

  const rawData = {
    componentId: formData.get("componentId"),
  };

  const validation = removeComponentSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: "Invalid component removal payload" };
  }

  const { componentId } = validation.data;

  try {
    const component = await prisma.component.findUnique({
      where: { id: componentId },
      include: {
        _count: {
          select: { resources: true },
        },
        classSubject: {
          include: {
            section: true,
            subject: true,
          },
        },
      },
    });

    if (!component) {
      return { error: "Component not found." };
    }

    // Rule 5: If resources exist for that component, block removal and show an error
    if (component._count.resources > 0) {
      return {
        error: `Cannot remove ${component.type} component: ${component._count.resources} resource(s) already uploaded to it.`,
      };
    }

    await prisma.component.delete({
      where: { id: componentId },
    });

    await writeAudit({
      actorId: admin.id,
      action: "component.remove",
      targetType: "component",
      targetId: componentId,
      metadata: {
        type: component.type,
        classSubjectId: component.classSubjectId,
        sectionName: component.classSubject.section.name,
        subjectCode: component.classSubject.subject.code,
      },
    });

    safeRevalidate("/admin/class-subjects");
    return { success: true };
  } catch (error) {
    console.error("removeComponent error:", error);
    return { error: "Failed to remove component" };
  }
}

// ==========================================
// HARD DELETE & REASSIGNMENT ACTIONS
// ==========================================

export async function checkSectionBlockers(sectionId: string): Promise<{
  students: number;
  classSubjects: number;
}> {
  await requireRole("super_admin");
  const students = await prisma.student.count({ where: { sectionId } });
  const classSubjects = await prisma.classSubject.count({ where: { sectionId } });
  return { students, classSubjects };
}

export async function moveSectionStudents(
  fromSectionId: string,
  toSectionId: string
): Promise<ActionResult> {
  await requireRole("super_admin");
  if (!fromSectionId || !toSectionId || fromSectionId === toSectionId) {
    return { error: "Please select a different destination section." };
  }
  const updateResult = await prisma.student.updateMany({
    where: { sectionId: fromSectionId },
    data: { sectionId: toSectionId },
  });
  safeRevalidate("/admin/sections");
  safeRevalidate("/admin/students");
  return { success: true, data: { movedCount: updateResult.count } };
}

export async function deleteSection(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");
  const sectionId = formData.get("sectionId") as string;
  const confirmName = (formData.get("confirmName") as string)?.trim();

  if (!sectionId) {
    return { error: "Section ID is required." };
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      _count: {
        select: { students: true, classSubjects: true },
      },
    },
  });

  if (!section) {
    return { error: "Section not found." };
  }

  if (confirmName && confirmName.toLowerCase() !== section.name.toLowerCase()) {
    return { error: `Confirmation name does not match "${section.name}".` };
  }

  if (section._count.students > 0 || section._count.classSubjects > 0) {
    return {
      error: `Cannot delete section: ${section._count.students} student(s) and ${section._count.classSubjects} subject link(s) exist.`,
      data: {
        blockers: {
          students: section._count.students,
          classSubjects: section._count.classSubjects,
        },
      },
    };
  }

  await prisma.section.delete({ where: { id: sectionId } });

  await writeAudit({
    actorId: admin.id,
    action: "section.delete",
    targetType: "section",
    targetId: sectionId,
    metadata: {
      sectionId,
      name: section.name,
    },
  });

  safeRevalidate("/admin/sections");
  safeRevalidate("/admin/class-subjects");
  return { success: true };
}

export async function checkSubjectBlockers(subjectId: string): Promise<{
  classSubjects: number;
  sections: string[];
}> {
  await requireRole("super_admin");
  const linked = await prisma.classSubject.findMany({
    where: { subjectId },
    include: { section: true },
  });
  return {
    classSubjects: linked.length,
    sections: linked.map((l) => l.section.name),
  };
}

export async function deleteSubject(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");
  const subjectId = formData.get("subjectId") as string;
  const confirmCode = (formData.get("confirmCode") as string)?.trim();

  if (!subjectId) {
    return { error: "Subject ID is required." };
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      classSubjects: {
        include: { section: true },
      },
    },
  });

  if (!subject) {
    return { error: "Subject not found." };
  }

  if (confirmCode && confirmCode.toUpperCase() !== subject.code.toUpperCase()) {
    return { error: `Confirmation code does not match "${subject.code}".` };
  }

  if (subject.classSubjects.length > 0) {
    const sectionNames = subject.classSubjects.map((cs) => cs.section.name);
    return {
      error: `Cannot delete subject: linked to ${subject.classSubjects.length} section(s) (${sectionNames.join(", ")}).`,
      data: {
        blockers: {
          classSubjects: subject.classSubjects.length,
          sectionNames,
        },
      },
    };
  }

  await prisma.subject.delete({ where: { id: subjectId } });

  await writeAudit({
    actorId: admin.id,
    action: "subject.delete",
    targetType: "subject",
    targetId: subjectId,
    metadata: {
      subjectId,
      code: subject.code,
    },
  });

  safeRevalidate("/admin/subjects");
  safeRevalidate("/admin/class-subjects");
  return { success: true };
}

export async function reassignComponentFaculty(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");
  const componentId = formData.get("componentId") as string;
  const toFacultyId = formData.get("toFacultyId") as string;

  if (!componentId || !toFacultyId) {
    return { error: "Component ID and New Faculty ID are required." };
  }

  const component = await prisma.component.findUnique({
    where: { id: componentId },
  });

  if (!component) {
    return { error: "Component not found." };
  }

  const newFaculty = await prisma.user.findUnique({
    where: { id: toFacultyId },
  });

  if (!newFaculty || newFaculty.role !== Role.faculty || !newFaculty.isActive) {
    return { error: "Selected user is not an active faculty member." };
  }

  const fromFacultyId = component.facultyId;

  await prisma.component.update({
    where: { id: componentId },
    data: { facultyId: toFacultyId },
  });

  await writeAudit({
    actorId: admin.id,
    action: "component.reassign",
    targetType: "component",
    targetId: componentId,
    metadata: {
      componentType: component.type,
      classSubjectId: component.classSubjectId,
      fromFacultyId,
      toFacultyId,
    },
  });

  safeRevalidate("/admin/class-subjects");
  return { success: true };
}

export async function removeComponentSafely(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");
  const componentId = formData.get("componentId") as string;
  const confirmCode = (formData.get("confirmCode") as string)?.trim();

  const component = await prisma.component.findUnique({
    where: { id: componentId },
    include: {
      resources: true,
      classSubject: {
        include: { section: true, subject: true },
      },
    },
  });

  if (!component) {
    return { error: "Component not found." };
  }

  const resourceCount = component.resources.length;

  if (resourceCount > 0) {
    const sub = component.classSubject.subject;
    const match =
      confirmCode &&
      (confirmCode.toLowerCase() === sub.name.toLowerCase() ||
        confirmCode.toUpperCase() === sub.code.toUpperCase());

    if (!match) {
      return {
        error: `Please type the subject code (${sub.code}) or subject name (${sub.name}) to confirm slot removal with active uploads.`,
      };
    }

    // Step 1: Delete all B2 objects first
    for (const res of component.resources) {
      try {
        await deleteObject(res.r2Key);
      } catch (err) {
        console.error("Failed to delete object from Backblaze B2:", err);
        return {
          error: "Failed to delete storage object from Backblaze B2. Slot removal aborted.",
        };
      }
    }

    // Step 2: Mark archived in DB
    await prisma.resource.updateMany({
      where: { componentId },
      data: { archived: true },
    });
  }

  // Step 3: Delete component row
  await prisma.component.delete({
    where: { id: componentId },
  });

  await writeAudit({
    actorId: admin.id,
    action: "component.remove",
    targetType: "component",
    targetId: componentId,
    metadata: {
      componentType: component.type,
      classSubjectId: component.classSubjectId,
      archivedResourceCount: resourceCount,
    },
  });

  safeRevalidate("/admin/class-subjects");
  return { success: true };
}

export async function unlinkSubjectFromSection(formData: FormData): Promise<ActionResult> {
  const admin = await requireRole("super_admin");
  const classSubjectId = formData.get("classSubjectId") as string;

  const cs = await prisma.classSubject.findUnique({
    where: { id: classSubjectId },
    include: {
      section: true,
      subject: true,
      components: {
        include: { resources: true },
      },
    },
  });

  if (!cs) {
    return { error: "Class subject not found." };
  }

  const totalResources = cs.components.reduce((acc, c) => acc + c.resources.length, 0);
  if (totalResources > 0) {
    return {
      error: `Cannot unlink subject: ${totalResources} uploaded resource(s) exist across components. Remove or archive them first.`,
    };
  }

  await prisma.classSubject.delete({
    where: { id: classSubjectId },
  });

  await writeAudit({
    actorId: admin.id,
    action: "class_subject.unlink",
    targetType: "class_subject",
    targetId: classSubjectId,
    metadata: {
      sectionName: cs.section.name,
      subjectCode: cs.subject.code,
    },
  });

  safeRevalidate("/admin/class-subjects");
  return { success: true };
}


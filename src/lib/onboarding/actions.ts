"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import {
  singleFacultySchema,
  facultyImportRowSchema,
  singleStudentSchema,
  studentImportRowSchema,
  studentTransferSchema,
  reassignFacultySchema,
  passwordResetSchema,
  studentActionSchema,
} from "@/lib/validations";
import { generateTemporaryPassword, parseExcelBuffer } from "@/lib/onboarding/utils";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { deleteObject } from "@/lib/storage";

export type OnboardingActionResult<T = unknown> = {
  success?: boolean;
  error?: string;
  data?: T;
};

// In-memory one-time store for credential CSVs.
// Self-destructs immediately upon first retrieval. Plain passwords never written to DB, disk, or logs.
interface StoredCredentialCsv {
  csvContent: string;
  expiresAt: number;
}
const oneTimeCsvStore = new Map<string, StoredCredentialCsv>();

export async function downloadCredentialCsv(
  batchToken: string
): Promise<OnboardingActionResult<{ csvContent: string }>> {
  await requireRole("super_admin");

  if (!batchToken || typeof batchToken !== "string") {
    return { error: "Invalid batch token." };
  }

  const stored = oneTimeCsvStore.get(batchToken);
  if (!stored) {
    return {
      error: "Credential CSV already downloaded or token expired. Credential CSVs can only be retrieved once.",
    };
  }

  if (Date.now() > stored.expiresAt) {
    oneTimeCsvStore.delete(batchToken);
    return {
      error: "Credential CSV token has expired.",
    };
  }

  // Atomically clear from memory on first retrieval
  oneTimeCsvStore.delete(batchToken);

  return {
    success: true,
    data: { csvContent: stored.csvContent },
  };
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // revalidatePath only succeeds within active Next.js request lifecycle
  }
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_FILE_EXTENSIONS = [".xlsx", ".xls", ".csv"];

function validateFileMetadata(file: File | null): { valid: boolean; error?: string } {
  if (!file || !(file instanceof File) || file.size === 0) {
    return { valid: false, error: "Please select a valid non-empty file." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size exceeds the 2 MB limit." };
  }
  const fileName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_FILE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExt) {
    return {
      valid: false,
      error: `Invalid file format. Only ${ALLOWED_FILE_EXTENSIONS.join(", ")} files are supported.`,
    };
  }
  return { valid: true };
}

// ==========================================
// 1. FACULTY MANAGEMENT
// ==========================================

export async function createSingleFaculty(
  formData: FormData
): Promise<OnboardingActionResult<{ tempPassword: string; faculty: { id: string; name: string; email: string } }>> {
  const admin = await requireRole("super_admin");

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  };

  const validation = singleFacultySchema.safeParse(raw);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid faculty details" };
  }

  const { name, email, phone } = validation.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: `A user with email "${email}" already exists.` };
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      role: Role.faculty,
      passwordHash,
      mustChangePassword: true,
      sessionVersion: 1,
      isActive: true,
    },
  });

  await writeAudit({
    actorId: admin.id,
    action: "faculty.create",
    targetType: "user",
    targetId: user.id,
    metadata: { name: user.name, email: user.email },
  });

  safeRevalidate("/admin/faculty");
  return {
    success: true,
    data: {
      tempPassword,
      faculty: { id: user.id, name: user.name, email: user.email },
    },
  };
}

export interface SkippedImportItem {
  row: number;
  identifier?: string;
  reason: string;
}

export async function importFacultyExcel(
  formData: FormData
): Promise<OnboardingActionResult<{ createdCount: number; skipped: SkippedImportItem[] }>> {
  const admin = await requireRole("super_admin");

  const file = formData.get("file") as File | null;
  const fileCheck = validateFileMetadata(file);
  if (!fileCheck.valid) {
    return { error: fileCheck.error };
  }

  const buffer = Buffer.from(await file!.arrayBuffer());
  const parseResult = parseExcelBuffer(buffer, {
    requiredHeaders: ["name", "email"],
    headerAliases: {
      phonenumber: "phone",
      mobile: "phone",
      contact: "phone",
    },
  });

  if (!parseResult.success || !parseResult.rows) {
    return { error: parseResult.error || "Failed to parse faculty sheet" };
  }

  const rows = parseResult.rows;
  const skipped: SkippedImportItem[] = [];
  const seenEmailsInFile = new Set<string>();
  const candidateRows: { rowNum: number; name: string; email: string; phone?: string | null }[] = [];
  const candidateEmails: string[] = [];

  // Pass 1: Syntax validation & in-file duplicate filtering
  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const validation = facultyImportRowSchema.safeParse(rawRow);
    if (!validation.success) {
      skipped.push({
        row: i + 2, // 1-indexed, skipping header row
        identifier: rawRow.email || rawRow.name || "Unknown",
        reason: validation.error.issues[0]?.message || "Validation failed",
      });
      continue;
    }

    const { name, email, phone } = validation.data;
    if (seenEmailsInFile.has(email)) {
      skipped.push({
        row: i + 2,
        identifier: email,
        reason: `Duplicate email "${email}" repeated in uploaded file`,
      });
      continue;
    }

    seenEmailsInFile.add(email);
    candidateEmails.push(email);
    candidateRows.push({
      rowNum: i + 2,
      name,
      email,
      phone,
    });
  }

  // Pass 2: Check database for existing emails
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: candidateEmails } },
    select: { email: true },
  });
  const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  const validRowsToCreate: { name: string; email: string; phone?: string | null; tempPassword: string; hash: string }[] = [];

  for (const candidate of candidateRows) {
    if (existingEmailSet.has(candidate.email)) {
      skipped.push({
        row: candidate.rowNum,
        identifier: candidate.email,
        reason: `Email "${candidate.email}" is already registered in the system`,
      });
      continue;
    }

    const tempPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    validRowsToCreate.push({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone || null,
      tempPassword,
      hash,
    });
  }

  // Create users in database
  let createdCount = 0;
  for (const item of validRowsToCreate) {
    await prisma.user.create({
      data: {
        name: item.name,
        email: item.email,
        phone: item.phone,
        role: Role.faculty,
        passwordHash: item.hash,
        mustChangePassword: true,
        sessionVersion: 1,
        isActive: true,
      },
    });
    createdCount++;
  }

  await writeAudit({
    actorId: admin.id,
    action: "faculty.import",
    targetType: "user",
    metadata: {
      totalRows: rows.length,
      createdCount,
      skippedCount: skipped.length,
    },
  });

  safeRevalidate("/admin/faculty");
  return {
    success: true,
    data: { createdCount, skipped },
  };
}

export async function reassignFaculty(formData: FormData): Promise<OnboardingActionResult> {
  const admin = await requireRole("super_admin");

  const raw = {
    componentId: formData.get("componentId"),
    newFacultyId: formData.get("newFacultyId"),
  };

  const validation = reassignFacultySchema.safeParse(raw);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid reassignment details" };
  }

  const { componentId, newFacultyId } = validation.data;

  const component = await prisma.component.findUnique({
    where: { id: componentId },
    include: {
      faculty: true,
      classSubject: {
        include: { subject: true, section: true },
      },
    },
  });

  if (!component) {
    return { error: "Component not found." };
  }

  const newFaculty = await prisma.user.findFirst({
    where: { id: newFacultyId, role: Role.faculty, isActive: true },
  });

  if (!newFaculty) {
    return { error: "Selected new faculty is invalid, inactive, or not a faculty member." };
  }

  const oldFaculty = component.faculty;

  await prisma.component.update({
    where: { id: componentId },
    data: { facultyId: newFacultyId },
  });

  await writeAudit({
    actorId: admin.id,
    action: "faculty.reassign",
    targetType: "component",
    targetId: component.id,
    metadata: {
      classSubjectId: component.classSubjectId,
      componentType: component.type,
      oldFacultyId: oldFaculty.id,
      oldFacultyName: oldFaculty.name,
      newFacultyId: newFaculty.id,
      newFacultyName: newFaculty.name,
    },
  });

  safeRevalidate("/admin/class-subjects");
  safeRevalidate("/admin/faculty");
  return { success: true };
}

// ==========================================
// 2. STUDENT MANAGEMENT
// ==========================================

export async function createSingleStudent(
  formData: FormData
): Promise<OnboardingActionResult<{ tempPassword: string; student: { id: string; rollNo: string; name: string; email: string } }>> {
  const admin = await requireRole("super_admin");

  const raw = {
    rollNo: formData.get("rollNo"),
    name: formData.get("name"),
    email: formData.get("email"),
    sectionId: formData.get("sectionId"),
    phone: formData.get("phone"),
  };

  const validation = singleStudentSchema.safeParse(raw);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid student details" };
  }

  const { rollNo, name, email, sectionId, phone } = validation.data;

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return { error: "Specified section does not exist." };
  }
  if (section.isArchived) {
    return { error: "Cannot add students to an archived section." };
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { error: `A user with email "${email}" already exists.` };
  }

  const existingRollNo = await prisma.student.findUnique({ where: { rollNo } });
  if (existingRollNo) {
    return { error: `A student with roll number "${rollNo}" already exists.` };
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const studentRecord = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        role: Role.student,
        passwordHash,
        mustChangePassword: true,
        sessionVersion: 1,
        isActive: true,
      },
    });

    const student = await tx.student.create({
      data: {
        userId: user.id,
        rollNo,
        sectionId,
      },
    });

    return { student, user };
  });

  await writeAudit({
    actorId: admin.id,
    action: "student.create",
    targetType: "student",
    targetId: studentRecord.student.id,
    metadata: {
      rollNo,
      email,
      sectionId,
    },
  });

  safeRevalidate("/admin/students");
  return {
    success: true,
    data: {
      tempPassword,
      student: {
        id: studentRecord.student.id,
        rollNo: studentRecord.student.rollNo,
        name: studentRecord.user.name,
        email: studentRecord.user.email,
      },
    },
  };
}

export async function importStudentsExcel(
  formData: FormData
): Promise<OnboardingActionResult<{ createdCount: number; skipped: SkippedImportItem[]; csvContent: string; batchToken?: string }>> {
  const admin = await requireRole("super_admin");

  const sectionId = formData.get("sectionId") as string;
  if (!sectionId) {
    return { error: "Section is required for student import." };
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return { error: "Selected section does not exist." };
  }
  if (section.isArchived) {
    return { error: "Cannot import students into an archived section." };
  }

  const file = formData.get("file") as File | null;
  const fileCheck = validateFileMetadata(file);
  if (!fileCheck.valid) {
    return { error: fileCheck.error };
  }

  const buffer = Buffer.from(await file!.arrayBuffer());
  const parseResult = parseExcelBuffer(buffer, {
    requiredHeaders: ["rollno", "name", "email"],
    headerAliases: {
      roll_no: "rollno",
      rollnumber: "rollno",
      roll: "rollno",
    },
  });

  if (!parseResult.success || !parseResult.rows) {
    return { error: parseResult.error || "Failed to parse student sheet" };
  }

  const rows = parseResult.rows;
  const skipped: SkippedImportItem[] = [];
  const seenRollsInFile = new Set<string>();
  const seenEmailsInFile = new Set<string>();
  const candidateRolls: string[] = [];
  const candidateEmails: string[] = [];
  const candidateRows: { rowNum: number; rollno: string; name: string; email: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const validation = studentImportRowSchema.safeParse(rawRow);
    if (!validation.success) {
      skipped.push({
        row: i + 2,
        identifier: rawRow.rollno || rawRow.email || "Unknown",
        reason: validation.error.issues[0]?.message || "Invalid row format",
      });
      continue;
    }

    const { rollno, name, email } = validation.data;
    if (seenRollsInFile.has(rollno)) {
      skipped.push({
        row: i + 2,
        identifier: rollno,
        reason: `Duplicate roll number "${rollno}" in file`,
      });
      continue;
    }
    if (seenEmailsInFile.has(email)) {
      skipped.push({
        row: i + 2,
        identifier: email,
        reason: `Duplicate email "${email}" in file`,
      });
      continue;
    }

    seenRollsInFile.add(rollno);
    seenEmailsInFile.add(email);
    candidateRolls.push(rollno);
    candidateEmails.push(email);
    candidateRows.push({
      rowNum: i + 2,
      rollno,
      name,
      email,
    });
  }

  // Bulk query existing DB records
  const [existingUsers, existingStudents] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: candidateEmails } },
      select: { email: true },
    }),
    prisma.student.findMany({
      where: { rollNo: { in: candidateRolls } },
      select: { rollNo: true },
    }),
  ]);

  const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));
  const existingRollSet = new Set(existingStudents.map((s) => s.rollNo.toUpperCase()));

  const validRowsToCreate: { rollNo: string; name: string; email: string; tempPassword: string; hash: string }[] = [];
  const credentialRecords: { rollNo: string; email: string; tempPassword: string }[] = [];

  for (const candidate of candidateRows) {
    if (existingRollSet.has(candidate.rollno)) {
      skipped.push({
        row: candidate.rowNum,
        identifier: candidate.rollno,
        reason: `Roll number "${candidate.rollno}" already exists in database`,
      });
      continue;
    }
    if (existingEmailSet.has(candidate.email)) {
      skipped.push({
        row: candidate.rowNum,
        identifier: candidate.email,
        reason: `Email "${candidate.email}" already registered in database`,
      });
      continue;
    }

    const tempPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(tempPassword, 10);

    validRowsToCreate.push({
      rollNo: candidate.rollno,
      name: candidate.name,
      email: candidate.email,
      tempPassword,
      hash,
    });
  }

  let createdCount = 0;
  for (const item of validRowsToCreate) {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: item.name,
          email: item.email,
          role: Role.student,
          passwordHash: item.hash,
          mustChangePassword: true,
          sessionVersion: 1,
          isActive: true,
        },
      });

      await tx.student.create({
        data: {
          userId: user.id,
          rollNo: item.rollNo,
          sectionId,
        },
      });
    });

    credentialRecords.push({
      rollNo: item.rollNo,
      email: item.email,
      tempPassword: item.tempPassword,
    });
    createdCount++;
  }

  // Construct in-memory credential CSV
  const csvLines = [
    "roll_no,email,password",
    ...credentialRecords.map((c) => `"${c.rollNo}","${c.email}","${c.tempPassword}"`),
  ];
  const csvContent = csvLines.join("\n");

  await writeAudit({
    actorId: admin.id,
    action: "student.import",
    targetType: "section",
    targetId: sectionId,
    metadata: {
      totalRows: rows.length,
      createdCount,
      skippedCount: skipped.length,
    },
  });

  const batchToken = crypto.randomUUID();
  if (credentialRecords.length > 0) {
    oneTimeCsvStore.set(batchToken, {
      csvContent,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
  }

  safeRevalidate("/admin/students");
  return {
    success: true,
    data: {
      createdCount,
      skipped,
      batchToken,
      csvContent,
    },
  };
}

export async function removeStudent(formData: FormData): Promise<OnboardingActionResult> {
  const admin = await requireRole("super_admin");

  const raw = { studentId: formData.get("studentId") };
  const validation = studentActionSchema.safeParse(raw);
  if (!validation.success) {
    return { error: "Invalid student ID." };
  }

  const student = await prisma.student.findUnique({
    where: { id: validation.data.studentId },
    include: { user: true },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  // Deactivate user instead of deleting
  await prisma.user.update({
    where: { id: student.userId },
    data: { isActive: false },
  });

  await writeAudit({
    actorId: admin.id,
    action: "student.remove",
    targetType: "student",
    targetId: student.id,
    metadata: {
      sectionId: student.sectionId,
      rollNo: student.rollNo,
      reason: "Removed/deactivated from section",
    },
  });

  safeRevalidate("/admin/students");
  return { success: true };
}

export async function transferStudent(formData: FormData): Promise<OnboardingActionResult> {
  const admin = await requireRole("super_admin");

  const raw = {
    studentId: formData.get("studentId"),
    newSectionId: formData.get("newSectionId"),
  };

  const validation = studentTransferSchema.safeParse(raw);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid transfer details" };
  }

  const { studentId, newSectionId } = validation.data;

  const [student, targetSection] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    prisma.section.findUnique({ where: { id: newSectionId } }),
  ]);

  if (!student) {
    return { error: "Student not found." };
  }
  if (!targetSection) {
    return { error: "Target section does not exist." };
  }
  if (targetSection.isArchived) {
    return { error: "Cannot transfer a student to an archived section." };
  }
  if (student.sectionId === newSectionId) {
    return { error: "Student is already enrolled in this section." };
  }

  const oldSectionId = student.sectionId;

  await prisma.student.update({
    where: { id: studentId },
    data: { sectionId: newSectionId },
  });

  await writeAudit({
    actorId: admin.id,
    action: "student.transfer",
    targetType: "student",
    targetId: student.id,
    metadata: {
      oldSectionId,
      newSectionId,
      rollNo: student.rollNo,
    },
  });

  safeRevalidate("/admin/students");
  return { success: true };
}

export async function toggleStudentActive(formData: FormData): Promise<OnboardingActionResult<{ isActive: boolean }>> {
  const admin = await requireRole("super_admin");

  const raw = { studentId: formData.get("studentId") };
  const validation = studentActionSchema.safeParse(raw);
  if (!validation.success) {
    return { error: "Invalid student ID." };
  }

  const student = await prisma.student.findUnique({
    where: { id: validation.data.studentId },
    include: { user: true },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  const updatedActive = !student.user.isActive;

  await prisma.user.update({
    where: { id: student.userId },
    data: { isActive: updatedActive },
  });

  await writeAudit({
    actorId: admin.id,
    action: "student.deactivate",
    targetType: "student",
    targetId: student.id,
    metadata: {
      isActive: updatedActive,
      rollNo: student.rollNo,
    },
  });

  safeRevalidate("/admin/students");
  return { success: true, data: { isActive: updatedActive } };
}

// ==========================================
// 3. ADMIN PASSWORD RESET (FACULTY & STUDENT)
// ==========================================

export async function resetUserPassword(
  formData: FormData
): Promise<OnboardingActionResult<{ tempPassword: string }>> {
  const admin = await requireRole("super_admin");

  const raw = { userId: formData.get("userId") };
  const validation = passwordResetSchema.safeParse(raw);
  if (!validation.success) {
    return { error: "Invalid user ID." };
  }

  const { userId } = validation.data;

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return { error: "User not found." };
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
  });

  await writeAudit({
    actorId: admin.id,
    action: "password.reset",
    targetType: "user",
    targetId: targetUser.id,
    metadata: {
      role: targetUser.role,
    },
  });

  safeRevalidate("/admin/faculty");
  safeRevalidate("/admin/students");

  return {
    success: true,
    data: { tempPassword },
  };
}

// ==========================================
// 4. HARD DELETE ACTIONS (STUDENT & FACULTY)
// ==========================================

export async function deleteStudent(formData: FormData): Promise<OnboardingActionResult> {
  const admin = await requireRole("super_admin");
  const studentId = formData.get("studentId") as string;
  const confirmRollNo = (formData.get("confirmRollNo") as string)?.trim();

  if (!studentId) {
    return { error: "Student ID is required." };
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  if (confirmRollNo && confirmRollNo.toUpperCase() !== student.rollNo.toUpperCase()) {
    return { error: `Confirmation roll number does not match "${student.rollNo}".` };
  }

  // Deleting user cascades to student, preserving audit logs with actorId set to null
  await prisma.user.delete({
    where: { id: student.userId },
  });

  await writeAudit({
    actorId: admin.id,
    action: "student.delete",
    targetType: "student",
    targetId: studentId,
    metadata: {
      studentId,
      rollNo: student.rollNo,
    },
  });

  safeRevalidate("/admin/students");
  return { success: true };
}

export async function checkFacultyBlockers(facultyId: string): Promise<{
  slots: number;
  resources: number;
  announcements: number;
  uploads: Array<{ id: string; title: string }>;
}> {
  await requireRole("super_admin");
  const slots = await prisma.component.count({ where: { facultyId } });
  const resources = await prisma.resource.count({ where: { uploadedBy: facultyId } });
  const announcements = await prisma.announcement.count({ where: { postedBy: facultyId } });
  const uploads = await prisma.resource.findMany({
    where: { uploadedBy: facultyId },
    select: { id: true, title: true },
  });
  return { slots, resources, announcements, uploads };
}

export async function deleteFacultyUploads(facultyId: string): Promise<OnboardingActionResult> {
  await requireRole("super_admin");
  const resources = await prisma.resource.findMany({
    where: { uploadedBy: facultyId },
  });

  for (const r of resources) {
    try {
      await deleteObject(r.r2Key);
    } catch (err) {
      console.error("Failed to delete B2 object:", err);
      return { error: "Failed to delete storage object from Backblaze B2. Aborted." };
    }
    await prisma.resource.delete({ where: { id: r.id } });
  }

  safeRevalidate("/admin/faculty");
  return { success: true };
}

export async function deleteFaculty(formData: FormData): Promise<OnboardingActionResult> {
  const admin = await requireRole("super_admin");
  const facultyId = formData.get("facultyId") as string;
  const confirmEmail = (formData.get("confirmEmail") as string)?.trim().toLowerCase();

  if (!facultyId) {
    return { error: "Faculty ID is required." };
  }

  const user = await prisma.user.findUnique({
    where: { id: facultyId },
    include: {
      componentsTaught: true,
      resourcesUploaded: true,
      announcements: true,
    },
  });

  if (!user || user.role !== Role.faculty) {
    return { error: "Faculty member not found." };
  }

  if (confirmEmail && confirmEmail !== user.email.toLowerCase()) {
    return { error: `Confirmation email does not match "${user.email}".` };
  }

  const slotCount = user.componentsTaught.length;
  const resourceCount = user.resourcesUploaded.length;
  const announcementCount = user.announcements.length;

  if (slotCount > 0 || resourceCount > 0 || announcementCount > 0) {
    return {
      error: `Cannot delete faculty member: ${slotCount} slot(s), ${resourceCount} upload(s), and ${announcementCount} announcement(s) exist.`,
      data: {
        blockers: {
          slots: slotCount,
          resources: resourceCount,
          announcements: announcementCount,
        },
      },
    };
  }

  const emailDomain = user.email.split("@")[1] || "";

  await prisma.user.delete({ where: { id: facultyId } });

  await writeAudit({
    actorId: admin.id,
    action: "faculty.delete",
    targetType: "faculty",
    targetId: facultyId,
    metadata: {
      facultyId,
      emailDomain,
    },
  });

  safeRevalidate("/admin/faculty");
  return { success: true };
}


import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Roll number or email is required")
    .trim(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters long"),
    confirmPassword: z
      .string()
      .min(8, "Confirm password must be at least 8 characters long"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const sectionSchema = z.object({
  name: z.string().min(1, "Section name is required").trim(),
  year: z.coerce
    .number()
    .int()
    .min(1, "Year must be between 1 and 4")
    .max(4, "Year must be between 1 and 4"),
  semester: z.coerce
    .number()
    .int()
    .min(1, "Semester must be between 1 and 8")
    .max(8, "Semester must be between 1 and 8"),
});

export type SectionInput = z.infer<typeof sectionSchema>;

export const updateSectionSchema = sectionSchema.extend({
  id: z.string().min(1, "Invalid section ID"),
});

export const toggleSectionArchiveSchema = z.object({
  id: z.string().min(1, "Invalid section ID"),
  isArchived: z.boolean(),
});

export const subjectSchema = z.object({
  code: z.string().min(1, "Subject code is required").trim().toUpperCase(),
  name: z.string().min(1, "Subject name is required").trim(),
  year: z.coerce
    .number()
    .int()
    .min(1, "Year must be between 1 and 4")
    .max(4, "Year must be between 1 and 4"),
  semester: z.coerce
    .number()
    .int()
    .min(1, "Semester must be between 1 and 8")
    .max(8, "Semester must be between 1 and 8"),
});

export type SubjectInput = z.infer<typeof subjectSchema>;

export const updateSubjectSchema = subjectSchema.extend({
  id: z.string().min(1, "Invalid subject ID"),
});

export const classSubjectSchema = z.object({
  sectionId: z.string().min(1, "Section is required"),
  subjectId: z.string().min(1, "Subject is required"),
});

export type ClassSubjectInput = z.infer<typeof classSubjectSchema>;

export const toggleClassSubjectActiveSchema = z.object({
  id: z.string().min(1, "Invalid class-subject ID"),
  isActive: z.boolean(),
});

export const assignComponentSchema = z.object({
  classSubjectId: z.string().min(1, "Class-Subject ID is required"),
  type: z.enum(["theory", "lab"]),
  facultyId: z.string().min(1, "Faculty is required"),
});

export type AssignComponentInput = z.infer<typeof assignComponentSchema>;

export const removeComponentSchema = z.object({
  componentId: z.string().min(1, "Component ID is required"),
});

// ==========================================
// STEP 4: ONBOARDING & MANAGEMENT SCHEMAS
// ==========================================

export const singleFacultySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  phone: z.string().trim().nullish().or(z.literal("")),
});
export type SingleFacultyInput = z.infer<typeof singleFacultySchema>;

export const facultyImportRowSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  phone: z.string().trim().nullish().or(z.literal("")),
});

export const singleStudentSchema = z.object({
  rollNo: z
    .string()
    .min(3, "Roll number must be at least 3 characters")
    .max(30, "Roll number too long")
    .trim()
    .toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  sectionId: z.string().uuid("Valid section is required"),
  phone: z.string().trim().nullish().or(z.literal("")),
});
export type SingleStudentInput = z.infer<typeof singleStudentSchema>;

export const studentImportRowSchema = z.object({
  rollno: z
    .string()
    .min(3, "Roll number must be at least 3 characters")
    .max(30, "Roll number too long")
    .trim()
    .toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  email: z.string().email("Invalid email address").trim().toLowerCase(),
});

export const studentTransferSchema = z.object({
  studentId: z.string().uuid("Valid student ID is required"),
  newSectionId: z.string().uuid("Valid new section is required"),
});
export type StudentTransferInput = z.infer<typeof studentTransferSchema>;

export const reassignFacultySchema = z.object({
  componentId: z.string().uuid("Valid component ID is required"),
  newFacultyId: z.string().uuid("Valid faculty ID is required"),
});
export type ReassignFacultyInput = z.infer<typeof reassignFacultySchema>;

export const passwordResetSchema = z.object({
  userId: z.string().uuid("Valid user ID is required"),
});
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export const studentActionSchema = z.object({
  studentId: z.string().uuid("Valid student ID is required"),
});

// ==========================================
// STEP 5: FACULTY PORTAL & RESOURCE UPLOAD SCHEMAS
// ==========================================

export const ALLOWED_RESOURCE_MIMES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "image/png": [".png"],
  "image/jpeg": [".jpeg", ".jpg"],
  "image/webp": [".webp"],
};

export const MAX_RESOURCE_SIZE_BYTES = 52428800; // 50 MB

export function sanitizeFilename(filename: string): string {
  const base = filename.replace(/^.*[\\\/]/, "");
  const sanitized = base.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return sanitized.slice(0, 100) || "unnamed_file";
}

export const presignUploadSchema = z.object({
  componentId: z.string().uuid("Invalid component ID"),
  category: z.enum([
    "unit_1",
    "unit_2",
    "unit_3",
    "unit_4",
    "unit_5",
    "mid_paper",
    "previous_paper",
    "important_questions",
    "reference",
  ]),
  title: z
    .string()
    .min(1, "Title is required")
    .max(150, "Title must be 150 characters or less")
    .trim(),
  message: z
    .string()
    .max(500, "Message must be 500 characters or less")
    .trim()
    .optional()
    .or(z.literal("")),
  filename: z.string().min(1, "Filename is required").max(200).trim(),
  mimeType: z.string().min(1, "MIME type is required").trim(),
  sizeBytes: z.coerce
    .number()
    .int("Size must be an integer")
    .positive("Size must be positive and non-zero")
    .max(MAX_RESOURCE_SIZE_BYTES, "File size must not exceed 50 MB"),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const confirmUploadSchema = z.object({
  resourceId: z.string().uuid("Invalid resource ID"),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

export const replaceResourceSchema = z.object({
  oldResourceId: z.string().uuid("Invalid old resource ID"),
  newResourceId: z.string().uuid("Invalid new resource ID"),
});
export type ReplaceResourceInput = z.infer<typeof replaceResourceSchema>;

export const deleteResourceSchema = z.object({
  resourceId: z.string().uuid("Invalid resource ID"),
});
export type DeleteResourceInput = z.infer<typeof deleteResourceSchema>;

export const createAnnouncementSchema = z.object({
  componentId: z.string().uuid("Invalid component ID"),
  message: z
    .string()
    .min(1, "Announcement message is required")
    .max(500, "Announcement cannot exceed 500 characters")
    .trim(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateFacultyProfileSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  phone: z.string().trim().optional().or(z.literal("")),
});
export type UpdateFacultyProfileInput = z.infer<typeof updateFacultyProfileSchema>;



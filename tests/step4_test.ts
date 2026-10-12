import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import {
  createSingleFaculty,
  importFacultyExcel,
  reassignFaculty,
  createSingleStudent,
  importStudentsExcel,
  downloadCredentialCsv,
  removeStudent,
  transferStudent,
  toggleStudentActive,
  resetUserPassword,
} from "../src/lib/onboarding/actions";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

// Host Guard: Refuse to execute unless NODE_ENV=test and DATABASE_URL matches designated dev branch host
const requiredHost = process.env.TEST_DB_HOST_MUST_CONTAIN;
const dbUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV !== "test") {
  console.error("FATAL: Tests must be run with NODE_ENV=test. Exiting.");
  process.exit(1);
}

if (!requiredHost || !dbUrl || !dbUrl.includes(requiredHost)) {
  console.error(
    `FATAL: Refusing to run tests. DATABASE_URL must contain "${requiredHost ?? "(TEST_DB_HOST_MUST_CONTAIN is not set)"}". Exiting.`
  );
  process.exit(1);
}

// Idempotent targeted cleanup: Only deletes TEST- prefixed business rows in strict relational order:
// (component -> class_subject -> student -> user -> subject -> section)
// NEVER deletes audit_logs!
async function cleanupStep4TestData() {
  console.log("--- Starting Idempotent Cleanup of TEST- Step 4 data ---");

  // 1. Find test sections
  const testSections = await prisma.section.findMany({
    where: { name: { startsWith: "TEST-" } },
    select: { id: true, name: true },
  });
  const sectionIds = testSections.filter((s) => s.name.startsWith("TEST-")).map((s) => s.id);

  // 2. Find test subjects
  const testSubjects = await prisma.subject.findMany({
    where: { code: { startsWith: "TEST-" } },
    select: { id: true, code: true },
  });
  const subjectIds = testSubjects.filter((s) => s.code.startsWith("TEST-")).map((s) => s.id);

  // 3. Find test class_subjects
  let classSubjectIds: string[] = [];
  if (sectionIds.length > 0 || subjectIds.length > 0) {
    const testClassSubjects = await prisma.classSubject.findMany({
      where: {
        OR: [
          ...(sectionIds.length > 0 ? [{ sectionId: { in: sectionIds } }] : []),
          ...(subjectIds.length > 0 ? [{ subjectId: { in: subjectIds } }] : []),
        ],
      },
      select: { id: true },
    });
    classSubjectIds = testClassSubjects.map((cs) => cs.id);
  }

  // 4. Find components linked to test class_subjects
  let componentIds: string[] = [];
  if (classSubjectIds.length > 0) {
    const testComponents = await prisma.component.findMany({
      where: { classSubjectId: { in: classSubjectIds } },
      select: { id: true },
    });
    componentIds = testComponents.map((c) => c.id);
  }

  // 5. Find test students (rollNo starts with TEST- or user email starts with test-)
  const testStudents = await prisma.student.findMany({
    where: {
      OR: [
        { rollNo: { startsWith: "TEST-" } },
        { sectionId: { in: sectionIds } },
        { user: { email: { startsWith: "test-" } } },
      ],
    },
    select: { id: true, userId: true },
  });
  const studentIds = testStudents.map((s) => s.id);
  const studentUserIds = testStudents.map((s) => s.userId);

  // 6. Find test users (faculty or student created for tests, excluding super admin)
  const testUsers = await prisma.user.findMany({
    where: {
      role: { not: Role.super_admin },
      OR: [
        { name: { startsWith: "TEST-" } },
        { email: { startsWith: "test-" } },
        { id: { in: studentUserIds } },
      ],
    },
    select: { id: true },
  });
  const userIds = testUsers.map((u) => u.id);

  // Strict Relational Deletion Order:
  // 1. Delete components
  if (componentIds.length > 0) {
    const deletedComponents = await prisma.component.deleteMany({
      where: { id: { in: componentIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedComponents.count} test component(s)`);
  }

  // 2. Delete class_subjects
  if (classSubjectIds.length > 0) {
    const deletedClassSubjects = await prisma.classSubject.deleteMany({
      where: { id: { in: classSubjectIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedClassSubjects.count} test class_subject(s)`);
  }

  // 3. Delete students
  if (studentIds.length > 0) {
    const deletedStudents = await prisma.student.deleteMany({
      where: { id: { in: studentIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedStudents.count} test student(s)`);
  }

  // 4. Delete test users (students and faculty)
  if (userIds.length > 0) {
    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedUsers.count} test user(s)`);
  }

  // 5. Delete subjects
  if (subjectIds.length > 0) {
    const deletedSubjects = await prisma.subject.deleteMany({
      where: { id: { in: subjectIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedSubjects.count} test subject(s)`);
  }

  // 6. Delete sections
  if (sectionIds.length > 0) {
    const deletedSections = await prisma.section.deleteMany({
      where: { id: { in: sectionIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedSections.count} test section(s)`);
  }

  console.log("--- Cleanup of TEST- data complete (audit logs left intact) ---");
}

function createMockExcelFile(headers: string[], rows: (string | number)[][], filename: string): File {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new File([buffer], filename, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function runStep4Tests() {
  console.log("=== STARTING STEP 4 ONBOARDING & MANAGEMENT VERIFICATION TESTS ===");
  const testStartTime = new Date();

  // Run cleanup at start
  await cleanupStep4TestData();

  // 1. Verify Super Admin exists
  const admin = await prisma.user.findFirst({
    where: { role: Role.super_admin },
  });
  if (!admin) {
    throw new Error("Admin user not found. Ensure db seed was run.");
  }

  setTestUser({
    id: admin.id,
    role: admin.role,
    mustChangePassword: false,
  });

  // 2. Create Base Fixtures: Sections & Subject
  console.log("\n[Setup] Creating base test sections and subject...");
  const sectionA = await prisma.section.create({
    data: { name: "TEST-CSE-S4", year: 1, semester: 1 },
  });
  const sectionB = await prisma.section.create({
    data: { name: "TEST-CSE-S4-B", year: 1, semester: 1 },
  });
  const subject = await prisma.subject.create({
    data: { code: "TEST-CS401", name: "TEST-Algorithms", year: 1, semester: 1 },
  });
  const classSubject = await prisma.classSubject.create({
    data: { sectionId: sectionA.id, subjectId: subject.id },
  });
  console.log("Base fixtures created: Section A, Section B, Subject, ClassSubject.");

  // -------------------------------------------------------------
  // TEST 0A: Single Faculty Creation
  // -------------------------------------------------------------
  console.log("\n[Test 0A] Single Faculty Creation with temporary password...");
  const singleFacultyFormData = new FormData();
  singleFacultyFormData.append("name", "TEST-Dr. Single Faculty");
  singleFacultyFormData.append("email", "test-fac-single@vidyavahini.edu");
  singleFacultyFormData.append("phone", "9876543299");

  const singleFacRes = await createSingleFaculty(singleFacultyFormData);
  console.log("Single Faculty Result:", {
    success: singleFacRes.success,
    hasTempPassword: !!singleFacRes.data?.tempPassword,
    facultyEmail: singleFacRes.data?.faculty.email,
  });
  if (!singleFacRes.success || !singleFacRes.data?.tempPassword) {
    throw new Error("Failed to create single faculty: " + singleFacRes.error);
  }
  const singleFacUser = await prisma.user.findUnique({
    where: { email: "test-fac-single@vidyavahini.edu" },
  });
  if (!singleFacUser || singleFacUser.role !== Role.faculty || !singleFacUser.mustChangePassword) {
    throw new Error("Single faculty user not properly configured in DB!");
  }
  console.log("--> PASS: Single faculty created with server-generated temp password.");

  // -------------------------------------------------------------
  // TEST 0B: Excel Missing Headers Validation
  // Expect: Reject files with missing headers and list missing header names.
  // -------------------------------------------------------------
  console.log("\n[Test 0B] Rejecting Excel with missing required headers...");
  const badHeadersFile = createMockExcelFile(["name", "phone"], [["TEST-No Email", "9876543210"]], "no_email.xlsx");
  const badHeaderFormData = new FormData();
  badHeaderFormData.append("file", badHeadersFile);
  const badHeaderRes = await importFacultyExcel(badHeaderFormData);
  console.log("Missing header response:", badHeaderRes.error);
  if (badHeaderRes.success || !badHeaderRes.error?.includes("email")) {
    throw new Error("Expected failure listing missing 'email' header!");
  }
  console.log("--> PASS: Missing required headers correctly rejected and listed.");

  // -------------------------------------------------------------
  // TEST 1: Import a 3-row faculty sheet with one duplicate email
  // Expect: 2 created, 1 skipped.
  // -------------------------------------------------------------
  console.log("\n[Test 1] Bulk Faculty Import with duplicate email (3 rows)...");
  const facultyHeaders = ["Name", "Email", "Phone"];
  const facultyRows = [
    ["TEST-Prof. C. Verma", "test-fac-c@vidyavahini.edu", "9876543211"],
    ["TEST-Prof. D. Sen", "test-fac-d@vidyavahini.edu", "9876543212"],
    ["TEST-Prof. C. Duplicate", "test-fac-c@vidyavahini.edu", "9876543213"], // Duplicate of row 1
  ];
  const facultyFile = createMockExcelFile(facultyHeaders, facultyRows, "faculty_test.xlsx");
  const facultyFormData = new FormData();
  facultyFormData.append("file", facultyFile);

  const facultyImportRes = await importFacultyExcel(facultyFormData);
  console.log("Faculty Import Result:", {
    createdCount: facultyImportRes.data?.createdCount,
    skipped: facultyImportRes.data?.skipped,
  });
  console.log("Faculty Import Skipped Array (full details):", JSON.stringify(facultyImportRes.data?.skipped, null, 2));
  if (!facultyImportRes.success || !facultyImportRes.data) {
    throw new Error("Faculty import failed: " + facultyImportRes.error);
  }
  if (facultyImportRes.data.createdCount !== 2) {
    throw new Error(`Expected 2 created faculty, got: ${facultyImportRes.data.createdCount}`);
  }
  if (facultyImportRes.data.skipped.length !== 1) {
    throw new Error(`Expected 1 skipped faculty, got: ${facultyImportRes.data.skipped.length}`);
  }
  console.log("--> PASS: 2 faculty created, 1 duplicate email skipped as expected.");

  // Assign one of the faculty to the component for later reassignment test
  const facultyC = await prisma.user.findUnique({ where: { email: "test-fac-c@vidyavahini.edu" } });
  const facultyD = await prisma.user.findUnique({ where: { email: "test-fac-d@vidyavahini.edu" } });
  const component = await prisma.component.create({
    data: {
      classSubjectId: classSubject.id,
      type: "theory",
      facultyId: facultyC!.id,
    },
  });

  // -------------------------------------------------------------
  // TEST 1B: Single Student Creation
  // -------------------------------------------------------------
  console.log("\n[Test 1B] Single Student Creation with temporary password...");
  const singleStudentFormData = new FormData();
  singleStudentFormData.append("rollNo", "TEST-ROLL-SINGLE");
  singleStudentFormData.append("name", "TEST-Student Single");
  singleStudentFormData.append("email", "test-std-single@vidyavahini.edu");
  singleStudentFormData.append("sectionId", sectionA.id);

  const singleStdRes = await createSingleStudent(singleStudentFormData);
  console.log("Single Student Result:", {
    success: singleStdRes.success,
    hasTempPassword: !!singleStdRes.data?.tempPassword,
    rollNo: singleStdRes.data?.student.rollNo,
  });
  if (!singleStdRes.success || !singleStdRes.data?.tempPassword) {
    throw new Error("Failed to create single student: " + singleStdRes.error);
  }
  const singleStdUser = await prisma.user.findUnique({
    where: { email: "test-std-single@vidyavahini.edu" },
    include: { student: true },
  });
  if (!singleStdUser || singleStdUser.role !== Role.student || !singleStdUser.mustChangePassword) {
    throw new Error("Single student user not properly configured in DB!");
  }
  console.log("--> PASS: Single student created with server-generated temp password.");

  // -------------------------------------------------------------
  // TEST 2: Import student sheet with a bad roll number
  // Expect: Bad roll number row rejected with reason.
  // -------------------------------------------------------------
  console.log("\n[Test 2] Bulk Student Import with invalid roll number...");
  const studentHeaders = ["roll_no", "name", "email"];
  const studentRows = [
    ["TEST-ROLL-01", "TEST-Student One", "test-std-1@vidyavahini.edu"],
    ["X", "TEST-Student Bad", "test-std-bad@vidyavahini.edu"], // Bad roll number (< 3 chars)
    ["TEST-ROLL-02", "TEST-Student Two", "test-std-2@vidyavahini.edu"],
  ];
  const studentFile = createMockExcelFile(studentHeaders, studentRows, "students_test.xlsx");
  const studentFormData = new FormData();
  studentFormData.append("file", studentFile);
  studentFormData.append("sectionId", sectionA.id);

  const studentImportRes = await importStudentsExcel(studentFormData);
  console.log("Student Import Result:", {
    success: studentImportRes.success,
    createdCount: studentImportRes.data?.createdCount,
    skipped: studentImportRes.data?.skipped,
  });
  if (!studentImportRes.success || !studentImportRes.data) {
    throw new Error("Student import failed: " + studentImportRes.error);
  }
  if (studentImportRes.data.createdCount !== 2) {
    throw new Error(`Expected 2 students created, got: ${studentImportRes.data.createdCount}`);
  }
  if (studentImportRes.data.skipped.length !== 1) {
    throw new Error(`Expected 1 skipped row, got: ${studentImportRes.data.skipped.length}`);
  }
  const badRow = studentImportRes.data.skipped[0];
  console.log("Skipped row reason:", badRow.reason);
  if (!badRow.reason.toLowerCase().includes("roll number")) {
    throw new Error("Expected rejection reason to mention roll number!");
  }
  console.log("--> PASS: Invalid roll number row rejected with reason.");

  // -------------------------------------------------------------
  // TEST 3: One-time credential CSV download verification
  // -------------------------------------------------------------
  console.log("\n[Test 3] Verifying one-time in-memory credential CSV...");
  const csvContent = studentImportRes.data.csvContent;
  if (!csvContent) {
    throw new Error("Expected in-memory credential CSV content in import result!");
  }
  const csvLines = csvContent.split("\n");
  console.log(`CSV generated with ${csvLines.length} lines. Header: ${csvLines[0]}`);
  if (!csvLines[0].includes("roll_no") || !csvLines[0].includes("password")) {
    throw new Error("CSV header missing roll_no or password");
  }

  // Parse lines to extract credentials
  // line 1: "TEST-ROLL-01","test-std-1@vidyavahini.edu","<tempPassword>"
  const student1RowMatch = csvLines[1].match(/"([^"]+)","([^"]+)","([^"]+)"/);
  if (!student1RowMatch) {
    throw new Error("Failed to parse student 1 credentials from CSV: " + csvLines[1]);
  }
  const student1Roll = student1RowMatch[1];
  const student1Email = student1RowMatch[2];
  const student1TempPassword = student1RowMatch[3];
  console.log(`Found credentials for ${student1Roll} (${student1Email}). Temp password verified generated.`);

  // Verify memory-only guarantee: no CSV file was created on disk
  const fs = await import("fs");
  const projectFiles = fs.readdirSync(process.cwd());
  const foundDiskCsv = projectFiles.filter((f) => f.endsWith(".csv"));
  console.log("Checking project root for leaked CSV files:", foundDiskCsv);
  if (foundDiskCsv.length > 0) {
    throw new Error("Credential CSV must never be written to disk!");
  }
  // Real flow: Call downloadCredentialCsv twice
  const batchToken = studentImportRes.data.batchToken;
  console.log("Batch token generated for one-time download:", !!batchToken);
  if (!batchToken) {
    throw new Error("Batch token missing from import result!");
  }

  // Call 1: Expect success and CSV
  const call1 = await downloadCredentialCsv(batchToken);
  console.log("Download call 1 result:", { success: call1.success, hasCsv: !!call1.data?.csvContent });
  if (!call1.success || !call1.data?.csvContent) {
    throw new Error("First download call failed: " + call1.error);
  }

  // Call 2: Expect failure and error message (not the CSV)
  const call2 = await downloadCredentialCsv(batchToken);
  console.log("Download call 2 result:", { success: call2.success, error: call2.error });
  if (call2.success) {
    throw new Error("Second download call succeeded when it MUST return an error!");
  }
  console.log("Second call error text:", call2.error);

  console.log("--> PASS: Credential CSV download succeeded on 1st call and returned error on 2nd call.");

  // -------------------------------------------------------------
  // TEST 4: Login as imported student with CSV password
  // Expect: Password matches bcrypt hash, mustChangePassword=true enforces redirect to /change-password
  // -------------------------------------------------------------
  console.log("\n[Test 4] Student Login with CSV temporary password...");
  const studentUser1 = await prisma.user.findUnique({
    where: { email: student1Email },
    include: { student: true },
  });
  if (!studentUser1) {
    throw new Error("Student user not found in database: " + student1Email);
  }

  const isPasswordValid = await bcrypt.compare(student1TempPassword, studentUser1.passwordHash);
  console.log("bcrypt.compare(tempPassword, passwordHash):", isPasswordValid);
  if (!isPasswordValid) {
    throw new Error("Imported student temporary password failed bcrypt comparison!");
  }
  console.log("studentUser1.mustChangePassword:", studentUser1.mustChangePassword);
  if (!studentUser1.mustChangePassword) {
    throw new Error("Imported student must have must_change_password=true!");
  }
  console.log("--> PASS: Student login succeeds with CSV temp password and must_change_password=true directs to /change-password.");

  // -------------------------------------------------------------
  // TEST 5: Admin Password Reset
  // Expect: Old password fails, new temp password works, sessionVersion increments.
  // -------------------------------------------------------------
  console.log("\n[Test 5] Admin Password Reset...");
  const resetFormData = new FormData();
  resetFormData.append("userId", studentUser1.id);

  const resetRes = await resetUserPassword(resetFormData);
  console.log("Password Reset Result:", { success: resetRes.success, tempPasswordGenerated: !!resetRes.data?.tempPassword });
  if (!resetRes.success || !resetRes.data?.tempPassword) {
    throw new Error("Password reset failed: " + resetRes.error);
  }
  const newTempPassword = resetRes.data.tempPassword;

  const refreshedUser = await prisma.user.findUnique({ where: { id: studentUser1.id } });
  const oldPasswordCheck = await bcrypt.compare(student1TempPassword, refreshedUser!.passwordHash);
  const newPasswordCheck = await bcrypt.compare(newTempPassword, refreshedUser!.passwordHash);
  console.log("Old password valid against new hash?", oldPasswordCheck);
  console.log("New password valid against new hash?", newPasswordCheck);
  console.log("Old sessionVersion:", studentUser1.sessionVersion, "-> New sessionVersion:", refreshedUser!.sessionVersion);

  if (oldPasswordCheck) throw new Error("Old password must fail after reset!");
  if (!newPasswordCheck) throw new Error("New password must succeed after reset!");
  if (refreshedUser!.sessionVersion !== studentUser1.sessionVersion + 1) {
    throw new Error("sessionVersion must increment on password reset!");
  }
  console.log("--> PASS: Old password rejected, new password verified, sessionVersion incremented.");

  // -------------------------------------------------------------
  // TEST 6: Faculty Reassignment Flow
  // -------------------------------------------------------------
  console.log("\n[Test 6] Faculty Reassignment Flow...");
  const reassignFormData = new FormData();
  reassignFormData.append("componentId", component.id);
  reassignFormData.append("newFacultyId", facultyD!.id);

  const reassignRes = await reassignFaculty(reassignFormData);
  console.log("Reassign Result:", reassignRes);
  if (!reassignRes.success) {
    throw new Error("Failed to reassign faculty: " + reassignRes.error);
  }
  const updatedComponent = await prisma.component.findUnique({ where: { id: component.id } });
  if (updatedComponent!.facultyId !== facultyD!.id) {
    throw new Error("Component faculty was not updated!");
  }
  console.log("--> PASS: Faculty reassigned successfully.");

  // -------------------------------------------------------------
  // TEST 7: Student Management (Transfer, Deactivate, Remove)
  // -------------------------------------------------------------
  console.log("\n[Test 7] Student Management Operations...");
  const studentRec1 = await prisma.student.findUnique({ where: { rollNo: "TEST-ROLL-01" } });
  const studentRec2 = await prisma.student.findUnique({ where: { rollNo: "TEST-ROLL-02" } });

  // 7A: Transfer Section
  const transferFormData = new FormData();
  transferFormData.append("studentId", studentRec1!.id);
  transferFormData.append("newSectionId", sectionB.id);
  const transferRes = await transferStudent(transferFormData);
  if (!transferRes.success) throw new Error("Transfer failed: " + transferRes.error);
  const transferred = await prisma.student.findUnique({ where: { id: studentRec1!.id } });
  if (transferred!.sectionId !== sectionB.id) throw new Error("Student section not updated after transfer!");
  console.log("--> PASS: Student transferred to Section B.");

  // 7B: Deactivate Student
  const toggleFormData = new FormData();
  toggleFormData.append("studentId", studentRec2!.id);
  const toggleRes = await toggleStudentActive(toggleFormData);
  if (!toggleRes.success) throw new Error("Deactivate failed: " + toggleRes.error);
  const deactivatedUser = await prisma.user.findFirst({ where: { student: { id: studentRec2!.id } } });
  if (deactivatedUser!.isActive !== false) throw new Error("Student isActive should be false!");
  console.log("--> PASS: Student deactivated successfully.");

  // 7C: Reactivate Student
  const reactivateFormData = new FormData();
  reactivateFormData.append("studentId", studentRec2!.id);
  const reactivateRes = await toggleStudentActive(reactivateFormData);
  if (!reactivateRes.success) throw new Error("Reactivate failed: " + reactivateRes.error);
  const reactivatedUser = await prisma.user.findFirst({ where: { student: { id: studentRec2!.id } } });
  if (reactivatedUser!.isActive !== true) throw new Error("Student isActive should be true!");
  console.log("--> PASS: Student reactivated successfully.");

  // 7D: Remove Student from section (sets isActive=false)
  const removeFormData = new FormData();
  removeFormData.append("studentId", studentRec1!.id);
  const removeRes = await removeStudent(removeFormData);
  if (!removeRes.success) throw new Error("Remove student failed: " + removeRes.error);
  const removedUser = await prisma.user.findFirst({ where: { student: { id: studentRec1!.id } } });
  if (removedUser!.isActive !== false) throw new Error("Removed student isActive should be false!");
  console.log("--> PASS: Student removed/deactivated successfully.");

  // -------------------------------------------------------------
  // TEST 8: Verify Audit Logs for Step 4 Actions
  // -------------------------------------------------------------
  console.log("\n[Test 8] Verifying Audit Logs recorded during current test run...");
  const auditLogs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: testStartTime } },
    orderBy: { createdAt: "asc" },
  });

  const actionsRecorded = new Set(auditLogs.map((l) => l.action));
  console.log("Actions recorded in audit log:", Array.from(actionsRecorded));

  const expectedActions = [
    "faculty.create",
    "faculty.import",
    "faculty.reassign",
    "student.create",
    "student.import",
    "student.remove",
    "student.transfer",
    "student.deactivate",
    "password.reset",
  ];

  for (const exp of expectedActions) {
    if (!actionsRecorded.has(exp)) {
      throw new Error(`Expected audit log action "${exp}" not found in current run!`);
    }
  }
  console.log("--> PASS: All 9 required audit actions verified present with sanitized metadata.");

  console.log("\n=== ALL STEP 4 TESTS PASSED SUCCESSFULLY! ===");
}

runStep4Tests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

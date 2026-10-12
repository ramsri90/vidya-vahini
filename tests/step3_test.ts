import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import {
  createSection,
  createSubject,
  linkClassSubject,
  assignComponent,
} from "../src/lib/academic/actions";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

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

// Idempotent targeted cleanup: Only deletes TEST- prefixed rows in strict relational order:
// (component, class_subject, subject, section)
async function cleanupTestData() {
  console.log("--- Starting Idempotent Cleanup of TEST- data ---");

  // 1. Find all sections starting with 'TEST-'
  const testSections = await prisma.section.findMany({
    where: { name: { startsWith: "TEST-" } },
    select: { id: true, name: true },
  });
  // Strict guard: ensure EVERY returned section actually starts with TEST-
  const sectionIds = testSections.filter((s) => s.name.startsWith("TEST-")).map((s) => s.id);

  // 2. Find all subjects starting with 'TEST-'
  const testSubjects = await prisma.subject.findMany({
    where: { code: { startsWith: "TEST-" } },
    select: { id: true, code: true },
  });
  // Strict guard: ensure EVERY returned subject actually starts with TEST-
  const subjectIds = testSubjects.filter((s) => s.code.startsWith("TEST-")).map((s) => s.id);

  // 3. Find class_subjects matching test sections or test subjects
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

  // 4. Find components matching test class_subjects
  let componentIds: string[] = [];
  if (classSubjectIds.length > 0) {
    const testComponents = await prisma.component.findMany({
      where: { classSubjectId: { in: classSubjectIds } },
      select: { id: true },
    });
    componentIds = testComponents.map((c) => c.id);
  }

  // Strictly ordered deletion: component -> class_subject -> subject -> section
  // 1. Delete components first
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

  // 3. Delete subjects
  if (subjectIds.length > 0) {
    const deletedSubjects = await prisma.subject.deleteMany({
      where: { id: { in: subjectIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedSubjects.count} test subject(s)`);
  }

  // 4. Delete test students if any reference test sections (due to RESTRICT constraint)
  if (sectionIds.length > 0) {
    const deletedStudents = await prisma.student.deleteMany({
      where: {
        OR: [
          { sectionId: { in: sectionIds } },
          { rollNo: { startsWith: "TEST-" } },
        ],
      },
    });
    if (deletedStudents.count > 0) {
      console.log(`[Cleanup] Deleted ${deletedStudents.count} test student(s)`);
    }
  }

  // 5. Delete sections
  if (sectionIds.length > 0) {
    const deletedSections = await prisma.section.deleteMany({
      where: { id: { in: sectionIds } },
    });
    console.log(`[Cleanup] Deleted ${deletedSections.count} test section(s)`);
  }

  // NOTE: Never delete audit_logs rows. Test cleanup only deletes business rows.
  console.log("--- Cleanup of TEST- data complete ---");
}

async function runStep3Tests() {
  console.log("=== STARTING STEP 3 IDEMPOTENT VERIFICATION TESTS ===");
  const testStartTime = new Date();

  // Run idempotent cleanup at the very start to ensure clean state
  await cleanupTestData();

  // 1. Verify Super Admin exists in database
  const admin = await prisma.user.findFirst({
    where: { role: Role.super_admin },
  });

  if (!admin) {
    throw new Error("Admin user not found. Ensure db seed was run.");
  }

  // Inject session for Super Admin via test-only helper
  setTestUser({
    id: admin.id,
    role: admin.role,
    mustChangePassword: false,
  });

  // 2. Upsert test faculty users with TEST- prefix email and name
  const passwordHash = await bcrypt.hash("TestFacultyPass123!", 10);

  const faculty1 = await prisma.user.upsert({
    where: { email: "test-faculty1@vidyavahini.edu" },
    update: { isActive: true },
    create: {
      name: "TEST-Dr. A. Sharma",
      email: "test-faculty1@vidyavahini.edu",
      role: Role.faculty,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const faculty2 = await prisma.user.upsert({
    where: { email: "test-faculty2@vidyavahini.edu" },
    update: { isActive: true },
    create: {
      name: "TEST-Prof. B. Rao",
      email: "test-faculty2@vidyavahini.edu",
      role: Role.faculty,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  console.log("Test users verified (Admin, TEST-Faculty 1, TEST-Faculty 2)");

  // -------------------------------------------------------------
  // TEST 1: Create TEST-CSE-1 and TEST-CSE-2 (Year 1, Semester 1)
  // -------------------------------------------------------------
  console.log("\n[Test 1] Creating TEST-CSE-1 and TEST-CSE-2 (Year 1, Semester 1)...");
  const sec1FormData = new FormData();
  sec1FormData.append("name", "TEST-CSE-1");
  sec1FormData.append("year", "1");
  sec1FormData.append("semester", "1");

  const sec1Res = await createSection(sec1FormData);
  console.log("Result TEST-CSE-1:", sec1Res);
  if (!sec1Res.success) throw new Error("Failed to create TEST-CSE-1: " + sec1Res.error);

  const sec2FormData = new FormData();
  sec2FormData.append("name", "TEST-CSE-2");
  sec2FormData.append("year", "1");
  sec2FormData.append("semester", "1");

  const sec2Res = await createSection(sec2FormData);
  console.log("Result TEST-CSE-2:", sec2Res);
  if (!sec2Res.success) throw new Error("Failed to create TEST-CSE-2: " + sec2Res.error);
  console.log("--> PASS: TEST-CSE-1 and TEST-CSE-2 created successfully in Year 1, Semester 1.");

  // Test duplicate section:
  const sec1DupFormData = new FormData();
  sec1DupFormData.append("name", "TEST-CSE-1");
  sec1DupFormData.append("year", "1");
  sec1DupFormData.append("semester", "1");
  const sec1DupRes = await createSection(sec1DupFormData);
  console.log("Result Duplicate TEST-CSE-1:", sec1DupRes);
  if (sec1DupRes.success) throw new Error("Duplicate TEST-CSE-1 should have been rejected");
  console.log("--> PASS: Duplicate section rejected with friendly error:", sec1DupRes.error);

  // -------------------------------------------------------------
  // TEST 2: Create Subject "TEST-Data Structures" (TEST-CS101)
  // -------------------------------------------------------------
  console.log("\n[Test 2] Creating Subject 'TEST-Data Structures' (TEST-CS101)...");
  const sub1FormData = new FormData();
  sub1FormData.append("code", "TEST-CS101");
  sub1FormData.append("name", "TEST-Data Structures");
  sub1FormData.append("year", "1");
  sub1FormData.append("semester", "1");

  const sub1Res = await createSubject(sub1FormData);
  console.log("Result Subject TEST-CS101:", sub1Res);
  if (!sub1Res.success) throw new Error("Failed to create TEST-CS101: " + sub1Res.error);

  console.log("Attempting to create duplicate Subject with same code TEST-CS101...");
  const subDupFormData = new FormData();
  subDupFormData.append("code", "TEST-CS101");
  subDupFormData.append("name", "TEST-Advanced Data Structures");
  subDupFormData.append("year", "2");
  subDupFormData.append("semester", "3");

  const subDupRes = await createSubject(subDupFormData);
  console.log("Result Duplicate TEST-CS101:", subDupRes);
  if (subDupRes.success) throw new Error("Duplicate code TEST-CS101 should have been rejected");
  console.log("--> PASS: Duplicate subject code rejected with friendly error:", subDupRes.error);

  // -------------------------------------------------------------
  // TEST 3: Link TEST-CSE-1 to TEST-CS101
  // -------------------------------------------------------------
  console.log("\n[Test 3] Linking TEST-CSE-1 to TEST-Data Structures...");
  const sec1 = await prisma.section.findFirst({ where: { name: "TEST-CSE-1" } });
  const sub1 = await prisma.subject.findUnique({ where: { code: "TEST-CS101" } });

  const linkFormData = new FormData();
  linkFormData.append("sectionId", sec1!.id);
  linkFormData.append("subjectId", sub1!.id);

  const linkRes = await linkClassSubject(linkFormData);
  console.log("Result Link TEST-CSE-1 -> TEST-CS101:", linkRes);
  if (!linkRes.success) throw new Error("Failed to link TEST-CSE-1 to TEST-CS101: " + linkRes.error);

  console.log("Attempting duplicate link TEST-CSE-1 -> TEST-CS101...");
  const linkDupRes = await linkClassSubject(linkFormData);
  console.log("Result Duplicate Link:", linkDupRes);
  if (linkDupRes.success) throw new Error("Duplicate link should have been rejected");
  console.log("--> PASS: Duplicate class-subject rejected with friendly message:", linkDupRes.error);

  const classSubject = await prisma.classSubject.findUnique({
    where: {
      sectionId_subjectId: {
        sectionId: sec1!.id,
        subjectId: sub1!.id,
      },
    },
  });

  // -------------------------------------------------------------
  // TEST 4: Assign Theory & Lab to same faculty, then reassign Lab
  // -------------------------------------------------------------
  console.log("\n[Test 4A] Assigning Theory and Lab to the SAME faculty (TEST-Dr. A. Sharma)...");
  const assignSameTheory = new FormData();
  assignSameTheory.append("classSubjectId", classSubject!.id);
  assignSameTheory.append("type", "theory");
  assignSameTheory.append("facultyId", faculty1.id);
  const resTheorySame = await assignComponent(assignSameTheory);
  if (!resTheorySame.success) throw new Error("Failed to assign theory: " + resTheorySame.error);

  const assignSameLab = new FormData();
  assignSameLab.append("classSubjectId", classSubject!.id);
  assignSameLab.append("type", "lab");
  assignSameLab.append("facultyId", faculty1.id);
  const resLabSame = await assignComponent(assignSameLab);
  if (!resLabSame.success) throw new Error("Failed to assign lab: " + resLabSame.error);

  console.log("--> PASS: Same faculty assigned to both Theory and Lab successfully.");

  console.log("\n[Test 4B] Reassigning Lab to DIFFERENT faculty (TEST-Prof. B. Rao)...");
  const assignDiffLab = new FormData();
  assignDiffLab.append("classSubjectId", classSubject!.id);
  assignDiffLab.append("type", "lab");
  assignDiffLab.append("facultyId", faculty2.id);
  const resLabDiff = await assignComponent(assignDiffLab);
  if (!resLabDiff.success) throw new Error("Failed to reassign lab: " + resLabDiff.error);
  console.log("--> PASS: Different faculty reassigned to Lab successfully.");

  // -------------------------------------------------------------
  // TEST 5: Assign non-faculty user (Super Admin) -> must be rejected
  // -------------------------------------------------------------
  console.log("\n[Test 5] Attempting to assign Super Admin as component faculty...");
  const assignAdminFormData = new FormData();
  assignAdminFormData.append("classSubjectId", classSubject!.id);
  assignAdminFormData.append("type", "theory");
  assignAdminFormData.append("facultyId", admin.id);
  const resAdminAssign = await assignComponent(assignAdminFormData);
  console.log("Result Assigning Admin:", resAdminAssign);
  if (resAdminAssign.success) throw new Error("Assigning admin as faculty should have been rejected!");
  console.log("--> PASS: Non-faculty user rejected with friendly error:", resAdminAssign.error);

  // -------------------------------------------------------------
  // TEST 6: Verify audit logs
  // -------------------------------------------------------------
  console.log("\n[Test 6] Verifying Audit Logs for test entities in current run...");
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: testStartTime },
      OR: [
        { targetId: sec1!.id },
        { targetId: sub1!.id },
        { targetId: classSubject!.id },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Recorded ${auditLogs.length} audit log entries for test entities.`);
  auditLogs.forEach((log) => {
    console.log(`- [${log.action}] targetType: ${log.targetType}, targetId: ${log.targetId}`);
  });
  if (auditLogs.length < 3) throw new Error("Expected at least 3 audit logs for created test entities!");
  console.log("--> PASS: Audit log entries recorded properly.");

  console.log("\n=== ALL STEP 3 TESTS PASSED SUCCESSFULLY! ===");
}

runStep3Tests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

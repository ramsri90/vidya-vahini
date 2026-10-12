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

// Idempotent targeted cleanup of TEST- data (Never delete audit_logs)
async function cleanupTestData() {
  console.log("--- Cleanup TEST- assignment regression data ---");
  const testSections = await prisma.section.findMany({
    where: { name: { startsWith: "TEST-" } },
    select: { id: true },
  });
  const sectionIds = testSections.map((s) => s.id);

  const testSubjects = await prisma.subject.findMany({
    where: { code: { startsWith: "TEST-" } },
    select: { id: true },
  });
  const subjectIds = testSubjects.map((s) => s.id);

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

  if (classSubjectIds.length > 0) {
    await prisma.resource.deleteMany({
      where: { component: { classSubjectId: { in: classSubjectIds } } },
    });
    await prisma.announcement.deleteMany({
      where: { component: { classSubjectId: { in: classSubjectIds } } },
    });
    await prisma.component.deleteMany({
      where: { classSubjectId: { in: classSubjectIds } },
    });
    await prisma.classSubject.deleteMany({
      where: { id: { in: classSubjectIds } },
    });
  }

  if (sectionIds.length > 0) {
    await prisma.student.deleteMany({ where: { sectionId: { in: sectionIds } } });
    await prisma.section.deleteMany({ where: { id: { in: sectionIds } } });
  }

  if (subjectIds.length > 0) {
    await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
  }

  const testUsers = await prisma.user.findMany({
    where: {
      role: { not: Role.super_admin },
      OR: [
        { name: { startsWith: "TEST-" } },
        { email: { startsWith: "test-" } },
      ],
    },
    select: { id: true },
  });
  if (testUsers.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: testUsers.map((u) => u.id) } },
    });
  }
}

async function runRegressionTest() {
  console.log("=== STARTING COMPONENT ASSIGNMENT REGRESSION TEST ===");
  await cleanupTestData();

  const admin = await prisma.user.findFirst({
    where: { role: Role.super_admin },
  });
  if (!admin) throw new Error("Super Admin required in DB");

  setTestUser({
    id: admin.id,
    role: admin.role,
    mustChangePassword: false,
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const f1 = await prisma.user.create({
    data: {
      name: "TEST-Dr. F1",
      email: "test-f1-reg@vidyavahini.edu",
      role: Role.faculty,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const f2 = await prisma.user.create({
    data: {
      name: "TEST-Dr. F2",
      email: "test-f2-reg@vidyavahini.edu",
      role: Role.faculty,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const sec = await prisma.section.create({
    data: { name: "TEST-SEC-REG", year: 1, semester: 1 },
  });

  const sub = await prisma.subject.create({
    data: { code: "TEST-SUB-REG", name: "TEST-Regression Subject", year: 1, semester: 1 },
  });

  const cs = await prisma.classSubject.create({
    data: { sectionId: sec.id, subjectId: sub.id },
  });

  // 1. Assign faculty F1 to class_subject X as THEORY.
  console.log("\n[Step 1] Assigning F1 as THEORY...");
  const fd1 = new FormData();
  fd1.append("classSubjectId", cs.id);
  fd1.append("type", "theory");
  fd1.append("facultyId", f1.id);
  const res1 = await assignComponent(fd1);
  if (!res1.success) throw new Error("Step 1 failed: " + res1.error);

  const comps1 = await prisma.component.findMany({ where: { classSubjectId: cs.id } });
  const theoryRow1 = comps1.find((c) => c.type === "theory");
  const labRow1 = comps1.find((c) => c.type === "lab");
  console.log("Components after Step 1:", comps1.map((c) => ({ type: c.type, facultyId: c.facultyId })));
  if (!theoryRow1 || theoryRow1.facultyId !== f1.id) {
    throw new Error("Step 1: Theory row must have faculty F1!");
  }
  if (labRow1) {
    throw new Error("Step 1: Lab row must be unchanged/empty!");
  }
  console.log("--> PASS Step 1: Theory row has F1, lab row unchanged.");

  // 2. Assign faculty F2 to class_subject X as LAB.
  console.log("\n[Step 2] Assigning F2 as LAB...");
  const fd2 = new FormData();
  fd2.append("classSubjectId", cs.id);
  fd2.append("type", "lab");
  fd2.append("facultyId", f2.id);
  const res2 = await assignComponent(fd2);
  if (!res2.success) throw new Error("Step 2 failed: " + res2.error);

  const comps2 = await prisma.component.findMany({ where: { classSubjectId: cs.id } });
  const theoryRow2 = comps2.find((c) => c.type === "theory");
  const labRow2 = comps2.find((c) => c.type === "lab");
  console.log("Components after Step 2:", comps2.map((c) => ({ type: c.type, facultyId: c.facultyId })));
  if (!theoryRow2 || theoryRow2.facultyId !== f1.id) {
    throw new Error("Step 2: Theory row must still be F1!");
  }
  if (!labRow2 || labRow2.facultyId !== f2.id) {
    throw new Error("Step 2: Lab row must have faculty F2!");
  }
  console.log("--> PASS Step 2: Theory row is still F1, Lab row has F2.");

  // 3. Assign F1 as THEORY again.
  console.log("\n[Step 3] Assigning F1 as THEORY again...");
  const fd3 = new FormData();
  fd3.append("classSubjectId", cs.id);
  fd3.append("type", "theory");
  fd3.append("facultyId", f1.id);
  const res3 = await assignComponent(fd3);
  if (!res3.success) throw new Error("Step 3 failed: " + res3.error);

  const comps3 = await prisma.component.findMany({ where: { classSubjectId: cs.id } });
  const theoryRow3 = comps3.find((c) => c.type === "theory");
  const labRow3 = comps3.find((c) => c.type === "lab");
  console.log("Components after Step 3:", comps3.map((c) => ({ type: c.type, facultyId: c.facultyId })));
  if (!theoryRow3 || theoryRow3.facultyId !== f1.id) {
    throw new Error("Step 3: Theory row must still be F1!");
  }
  if (!labRow3 || labRow3.facultyId !== f2.id) {
    throw new Error("Step 3: Lab row must still be F2!");
  }
  console.log("--> PASS Step 3: Theory row still F1, Lab row still F2.");

  await cleanupTestData();
  console.log("\n=== ALL REGRESSION TESTS PASSED! ===");
}

runRegressionTest()
  .catch((e) => {
    console.error("Regression test error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

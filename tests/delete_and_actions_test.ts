import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import {
  deleteSection,
  deleteSubject,
  reassignComponentFaculty,
} from "../src/lib/academic/actions";
import {
  deleteStudent,
  deleteFaculty,
  deleteFacultyUploads,
} from "../src/lib/onboarding/actions";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getS3Client, getBucketName } from "../src/lib/storage";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// Run tests

async function runDeleteTests() {
  console.log("=== RUNNING PART 6: HARD DELETE & BLOCKERS TESTS (TEST- PREFIX ONLY) ===");

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@gmail.com" },
  });
  if (!adminUser) throw new Error("Admin user admin@gmail.com not found!");

  // Setup test session mock
  setTestUser(adminUser);

  // Clean any old test rows with TEST- prefix
  await prisma.resource.deleteMany({ where: { title: { startsWith: "TEST-" } } });
  await prisma.component.deleteMany({ where: { classSubject: { subject: { code: { startsWith: "TEST-" } } } } });
  await prisma.classSubject.deleteMany({ where: { subject: { code: { startsWith: "TEST-" } } } });
  await prisma.student.deleteMany({ where: { rollNo: { startsWith: "TEST-" } } });
  await prisma.section.deleteMany({ where: { name: { startsWith: "TEST-DEL-" } } });
  await prisma.subject.deleteMany({ where: { code: { startsWith: "TEST-DEL-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "test-del-" } } });

  // -------------------------------------------------------------------------
  // TEST 1: Delete an empty section
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1: Delete an empty section]");
  const emptySec = await prisma.section.create({
    data: { name: "TEST-DEL-SEC-EMPTY", year: 2, semester: 3 },
  });
  console.log("Created empty section:", emptySec.name, emptySec.id);

  const fd1 = new FormData();
  fd1.append("sectionId", emptySec.id);
  fd1.append("confirmName", emptySec.name);
  const res1 = await deleteSection(fd1);
  console.log("deleteSection result:", res1);

  const audit1 = await prisma.auditLog.findFirst({
    where: { action: "section.delete", targetId: emptySec.id },
  });
  console.log("Audit log row found:", audit1?.action, audit1?.metadata);
  if (!res1.success || !audit1) throw new Error("Test 1 failed!");

  // -------------------------------------------------------------------------
  // TEST 2: Delete a section with students (expect blocked)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 2: Delete a section with students (expect blocked)]");
  const blockedSec = await prisma.section.create({
    data: { name: "TEST-DEL-SEC-POPULATED", year: 1, semester: 1 },
  });
  const stUser = await prisma.user.create({
    data: {
      name: "TEST-Student 1",
      email: "test-del-student-pop@vidyavahini.edu",
      role: Role.student,
      passwordHash: "hash",
    },
  });
  await prisma.student.create({
    data: {
      userId: stUser.id,
      rollNo: "TEST-DEL-R001",
      sectionId: blockedSec.id,
    },
  });

  const fd2 = new FormData();
  fd2.append("sectionId", blockedSec.id);
  fd2.append("confirmName", blockedSec.name);
  const res2 = await deleteSection(fd2);
  console.log("deleteSection result (expect blocked):", res2);
  if (res2.success || !res2.error?.includes("student(s)")) throw new Error("Test 2 failed!");

  // -------------------------------------------------------------------------
  // TEST 3: Delete an empty subject
  // -------------------------------------------------------------------------
  console.log("\n[TEST 3: Delete an empty subject]");
  const emptySub = await prisma.subject.create({
    data: { code: "TEST-DEL-CS901", name: "TEST-Empty Course", year: 3, semester: 5 },
  });
  console.log("Created empty subject:", emptySub.code, emptySub.id);

  const fd3 = new FormData();
  fd3.append("subjectId", emptySub.id);
  fd3.append("confirmCode", emptySub.code);
  const res3 = await deleteSubject(fd3);
  console.log("deleteSubject result:", res3);

  const audit3 = await prisma.auditLog.findFirst({
    where: { action: "subject.delete", targetId: emptySub.id },
  });
  console.log("Audit log row found:", audit3?.action, audit3?.metadata);
  if (!res3.success || !audit3) throw new Error("Test 3 failed!");

  // -------------------------------------------------------------------------
  // TEST 4: Delete a subject linked to a section (expect blocked)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 4: Delete a subject linked to a section (expect blocked)]");
  const linkedSub = await prisma.subject.create({
    data: { code: "TEST-DEL-CS902", name: "TEST-Linked Course", year: 2, semester: 4 },
  });
  const linkedSec = await prisma.section.create({
    data: { name: "TEST-DEL-SEC-LINKED", year: 2, semester: 4 },
  });
  const csLink = await prisma.classSubject.create({
    data: { sectionId: linkedSec.id, subjectId: linkedSub.id },
  });

  const fd4 = new FormData();
  fd4.append("subjectId", linkedSub.id);
  fd4.append("confirmCode", linkedSub.code);
  const res4 = await deleteSubject(fd4);
  console.log("deleteSubject result (expect blocked):", res4);
  if (res4.success || !res4.error?.includes("linked")) throw new Error("Test 4 failed!");

  // -------------------------------------------------------------------------
  // TEST 5: Delete a faculty with slots (blocked), reassign, then delete (success)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 5: Delete a faculty with slots -> reassign -> delete]");
  const fac1 = await prisma.user.create({
    data: {
      name: "TEST-Fac With Slots",
      email: "test-del-fac-slots@vidyavahini.edu",
      role: Role.faculty,
      passwordHash: "hash",
    },
  });
  const fac2 = await prisma.user.create({
    data: {
      name: "TEST-Fac Standin",
      email: "test-del-fac-standin@vidyavahini.edu",
      role: Role.faculty,
      passwordHash: "hash",
    },
  });
  const compSlot = await prisma.component.create({
    data: {
      classSubjectId: csLink.id,
      type: "theory",
      facultyId: fac1.id,
    },
  });

  const fd5a = new FormData();
  fd5a.append("facultyId", fac1.id);
  fd5a.append("confirmEmail", fac1.email);
  const res5a = await deleteFaculty(fd5a);
  console.log("deleteFaculty (with slots, expect blocked):", res5a);
  if (res5a.success || !res5a.error?.includes("slot(s)")) throw new Error("Test 5a failed!");

  // Reassign the slot to fac2
  const fd5b = new FormData();
  fd5b.append("componentId", compSlot.id);
  fd5b.append("toFacultyId", fac2.id);
  const res5b = await reassignComponentFaculty(fd5b);
  console.log("reassignComponentFaculty result:", res5b);

  const auditReassign = await prisma.auditLog.findFirst({
    where: { action: "component.reassign", targetId: compSlot.id },
    orderBy: { createdAt: "desc" },
  });
  console.log("Audit component.reassign row found:", auditReassign?.metadata);

  // Now delete fac1
  const res5c = await deleteFaculty(fd5a);
  console.log("deleteFaculty after reassign (expect success):", res5c);

  const auditFacDelete = await prisma.auditLog.findFirst({
    where: { action: "faculty.delete", targetId: fac1.id },
  });
  console.log("Audit faculty.delete row found:", auditFacDelete?.metadata);
  if (!res5c.success || !auditFacDelete) throw new Error("Test 5c failed!");

  // -------------------------------------------------------------------------
  // TEST 6: Delete a faculty with uploads -> delete uploads -> delete faculty
  // -------------------------------------------------------------------------
  console.log("\n[TEST 6: Delete a faculty with uploads -> delete uploads -> delete faculty]");
  const facUploads = await prisma.user.create({
    data: {
      name: "TEST-Fac With Uploads",
      email: "test-del-fac-uploads@vidyavahini.edu",
      role: Role.faculty,
      passwordHash: "hash",
    },
  });

  // Create an actual object in B2 storage
  const storageKey = `test-del-key-${Date.now()}.pdf`;
  const s3 = getS3Client();
  const bucket = getBucketName();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: Buffer.from("%PDF-1.4 TEST DATA"),
      ContentType: "application/pdf",
    })
  );

  await prisma.resource.create({
    data: {
      componentId: compSlot.id,
      uploadedBy: facUploads.id,
      category: "unit_1",
      title: "TEST-Lecture Notes",
      r2Key: storageKey,
      status: "ready",
    },
  });

  const fd6a = new FormData();
  fd6a.append("facultyId", facUploads.id);
  fd6a.append("confirmEmail", facUploads.email);
  const res6a = await deleteFaculty(fd6a);
  console.log("deleteFaculty (with uploads, expect blocked):", res6a);
  if (res6a.success || !res6a.error?.includes("upload(s)")) throw new Error("Test 6a failed!");

  // Delete uploads (B2 first, then DB)
  const res6b = await deleteFacultyUploads(facUploads.id);
  console.log("deleteFacultyUploads result:", res6b);

  // Verify object is gone from B2
  let objectStillExists = true;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) {
      objectStillExists = false;
    }
  }
  console.log("Storage object deleted from B2?", !objectStillExists);
  if (objectStillExists) throw new Error("Object still in B2 storage!");

  // Now delete faculty
  const res6c = await deleteFaculty(fd6a);
  console.log("deleteFaculty after deleting uploads (expect success):", res6c);
  if (!res6c.success) throw new Error("Test 6c failed!");

  // -------------------------------------------------------------------------
  // TEST 7: Delete a student
  // -------------------------------------------------------------------------
  console.log("\n[TEST 7: Delete a student]");
  const delStudentUser = await prisma.user.create({
    data: {
      name: "TEST-Student To Delete",
      email: "test-del-student-x@vidyavahini.edu",
      role: Role.student,
      passwordHash: await bcrypt.hash("Pass123!", 10),
      isActive: true,
    },
  });
  const delStudentRecord = await prisma.student.create({
    data: {
      userId: delStudentUser.id,
      rollNo: "TEST-DEL-ROLL-X",
      sectionId: linkedSec.id,
    },
  });

  const fd7 = new FormData();
  fd7.append("studentId", delStudentRecord.id);
  fd7.append("confirmRollNo", delStudentRecord.rollNo);
  const res7 = await deleteStudent(fd7);
  console.log("deleteStudent result:", res7);

  const auditStudentDelete = await prisma.auditLog.findFirst({
    where: { action: "student.delete", targetId: delStudentRecord.id },
  });
  console.log("Audit student.delete row found:", auditStudentDelete?.metadata);

  // Confirm user and student are deleted from database
  const userCheck = await prisma.user.findUnique({ where: { id: delStudentUser.id } });
  const studentCheck = await prisma.student.findUnique({ where: { id: delStudentRecord.id } });
  console.log("User in DB:", userCheck ? "Still exists" : "Deleted");
  console.log("Student in DB:", studentCheck ? "Still exists" : "Deleted");

  if (!res7.success || !auditStudentDelete || userCheck || studentCheck) {
    throw new Error("Test 7 failed!");
  }

  console.log("\n✓ ALL PART 6 DELETE & REASSIGNMENT TESTS PASSED SUCCESSFULLY!");
}

runDeleteTests()
  .catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

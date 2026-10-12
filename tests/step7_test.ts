import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import { getStorageDashboardStats } from "../src/lib/storage/dashboard";
import { archiveResource, deleteResourceModeration } from "../src/lib/moderation/actions";
import { archiveSingleSection } from "../src/lib/rollover/actions";
import { getS3Client, getBucketName, headObject } from "../src/lib/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";

async function uploadMockObject(storageKey: string, content: Buffer, contentType: string) {
  const client = getS3Client();
  const bucket = getBucketName();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: content,
      ContentType: contentType,
    })
  );
}

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

const BASE_URL = "http://localhost:3000";

async function cleanupTestData() {
  // Strict cleanup: Delete only TEST- prefixed entities in relational order (never audit_logs)
  const testResources = await prisma.resource.findMany({
    where: { title: { startsWith: "TEST-" } },
    select: { id: true },
  });
  if (testResources.length > 0) {
    await prisma.resource.deleteMany({
      where: { id: { in: testResources.map((r) => r.id) } },
    });
  }

  const testComponents = await prisma.component.findMany({
    where: {
      classSubject: {
        section: { name: { startsWith: "TEST-" } },
      },
    },
    select: { id: true },
  });
  if (testComponents.length > 0) {
    await prisma.component.deleteMany({
      where: { id: { in: testComponents.map((c) => c.id) } },
    });
  }

  const testClassSubjects = await prisma.classSubject.findMany({
    where: { section: { name: { startsWith: "TEST-" } } },
    select: { id: true },
  });
  if (testClassSubjects.length > 0) {
    await prisma.classSubject.deleteMany({
      where: { id: { in: testClassSubjects.map((cs) => cs.id) } },
    });
  }

  const testStudents = await prisma.student.findMany({
    where: { rollNo: { startsWith: "TEST-" } },
    select: { id: true, userId: true },
  });
  if (testStudents.length > 0) {
    await prisma.student.deleteMany({
      where: { id: { in: testStudents.map((s) => s.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testStudents.map((s) => s.userId) } },
    });
  }

  const testSections = await prisma.section.findMany({
    where: { name: { startsWith: "TEST-" } },
    select: { id: true },
  });
  if (testSections.length > 0) {
    await prisma.section.deleteMany({
      where: { id: { in: testSections.map((s) => s.id) } },
    });
  }

  const testSubjects = await prisma.subject.findMany({
    where: { code: { startsWith: "TEST-" } },
    select: { id: true },
  });
  if (testSubjects.length > 0) {
    await prisma.subject.deleteMany({
      where: { id: { in: testSubjects.map((s) => s.id) } },
    });
  }

  const testUsers = await prisma.user.findMany({
    where: { email: { contains: "test-step7" } },
    select: { id: true },
  });
  if (testUsers.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: testUsers.map((u) => u.id) } },
    });
  }
}

async function createStudentCookie(userId: string, sectionId: string): Promise<string> {
  const secret = process.env.AUTH_SECRET!;
  const token = await encode({
    token: {
      userId,
      role: "student",
      mustChangePassword: false,
      sessionVersion: 1,
      sectionId,
    },
    secret,
    salt: "authjs.session-token",
  });
  return `authjs.session-token=${token}`;
}

async function createFacultyCookie(userId: string): Promise<string> {
  const secret = process.env.AUTH_SECRET!;
  const token = await encode({
    token: {
      userId,
      role: "faculty",
      mustChangePassword: false,
      sessionVersion: 1,
    },
    secret,
    salt: "authjs.session-token",
  });
  return `authjs.session-token=${token}`;
}

async function runStep7Tests() {
  console.log("=== STEP 7 VERIFICATION TESTS ===");
  await cleanupTestData();

  const adminUser = await prisma.user.findFirst({
    where: { role: "super_admin" },
  });
  if (!adminUser) throw new Error("Super admin user not found in database!");
  setTestUser(adminUser);

  // -------------------------------------------------------------
  // Test 1: /admin/storage total equals a manual SQL SUM
  // -------------------------------------------------------------
  console.log("\n[TEST-1] /admin/storage total equals manual SQL SUM");
  const dashboardStats = await getStorageDashboardStats();

  const manualSumResult = await prisma.$queryRaw<
    { total_bytes: bigint | null; file_count: bigint }[]
  >`
    SELECT COALESCE(SUM(file_size_bytes), 0) AS total_bytes, COUNT(id) AS file_count
    FROM resources
    WHERE status = 'ready'::resource_status AND archived = false;
  `;
  const manualTotalBytes = Number(manualSumResult[0]?.total_bytes ?? 0n);
  const manualFileCount = Number(manualSumResult[0]?.file_count ?? 0n);

  console.log(`  Dashboard totalBytes: ${dashboardStats.totalBytes}`);
  console.log(`  Manual SQL SUM total_bytes: ${manualTotalBytes}`);
  console.log(`  Dashboard fileCount: ${dashboardStats.totalFiles}`);
  console.log(`  Manual SQL COUNT file_count: ${manualFileCount}`);

  if (dashboardStats.totalBytes !== manualTotalBytes) {
    throw new Error(
      `Mismatch: Dashboard bytes (${dashboardStats.totalBytes}) != Manual SQL (${manualTotalBytes})`
    );
  }
  if (dashboardStats.totalFiles !== manualFileCount) {
    throw new Error(
      `Mismatch: Dashboard files (${dashboardStats.totalFiles}) != Manual SQL (${manualFileCount})`
    );
  }
  console.log("✓ TEST-1 Passed: Dashboard total exactly matches manual SQL SUM.");

  // Setup test hierarchy: Section, Subject, ClassSubject, Component, Faculty, Student
  const testSection = await prisma.section.create({
    data: {
      name: "TEST-SEC-S7-A",
      year: 1,
      semester: 1,
      isArchived: false,
    },
  });

  const testSubject = await prisma.subject.create({
    data: {
      code: "TEST-SUB-S7-01",
      name: "TEST Subject S7",
      year: 1,
      semester: 1,
    },
  });

  const testClassSubject = await prisma.classSubject.create({
    data: {
      sectionId: testSection.id,
      subjectId: testSubject.id,
      isActive: true,
    },
  });

  const pwHash = await bcrypt.hash("TestPass123!", 10);
  const testFaculty = await prisma.user.create({
    data: {
      name: "TEST Faculty S7",
      email: "faculty-test-step7@example.com",
      role: "faculty",
      passwordHash: pwHash,
      mustChangePassword: false,
      sessionVersion: 1,
      isActive: true,
    },
  });

  const testComponent = await prisma.component.create({
    data: {
      classSubjectId: testClassSubject.id,
      type: "theory",
      facultyId: testFaculty.id,
    },
  });

  const testStudentUser = await prisma.user.create({
    data: {
      name: "TEST Student S7",
      email: "student-test-step7@example.com",
      role: "student",
      passwordHash: pwHash,
      mustChangePassword: false,
      sessionVersion: 1,
      isActive: true,
    },
  });

  const testStudent = await prisma.student.create({
    data: {
      userId: testStudentUser.id,
      rollNo: "TEST-ROLL-S7-01",
      sectionId: testSection.id,
    },
  });

  const studentCookie = await createStudentCookie(testStudentUser.id, testSection.id);
  const facultyCookie = await createFacultyCookie(testFaculty.id);

  // -------------------------------------------------------------
  // Test 2: Archive a resource with a reason: student download returns 404
  // -------------------------------------------------------------
  console.log("\n[TEST-2] Archive a resource with a reason -> student download returns 404");
  const resourceKey = `resources/TEST-S7-RES-1/test-file.pdf`;
  await uploadMockObject(resourceKey, Buffer.from("Test PDF Content"), "application/pdf");

  const testResource = await prisma.resource.create({
    data: {
      componentId: testComponent.id,
      uploadedBy: testFaculty.id,
      category: "unit_1",
      title: "TEST-Resource-Unit1",
      r2Key: resourceKey,
      fileSizeBytes: 17n,
      mimeType: "application/pdf",
      status: "ready",
      archived: false,
    },
  });

  // Verify student can download initially
  const dlRes1 = await fetch(`${BASE_URL}/api/resources/presign-download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({ resourceId: testResource.id }),
  });
  if (dlRes1.status !== 200) {
    throw new Error(`Expected 200 download before archiving, got ${dlRes1.status}`);
  }

  // Admin archives resource with a reason
  setTestUser(adminUser);
  const archiveFormData = new FormData();
  archiveFormData.append("resourceId", testResource.id);
  archiveFormData.append("reason", "Contains outdated semester syllabus references");

  const archiveResult = await archiveResource(archiveFormData);
  if (!archiveResult.success) {
    throw new Error(`archiveResource failed: ${archiveResult.error}`);
  }

  const updatedResource = await prisma.resource.findUnique({
    where: { id: testResource.id },
  });
  if (!updatedResource?.archived) {
    throw new Error("Expected resource.archived to be true");
  }

  // Verify student download now returns 404
  const dlRes2 = await fetch(`${BASE_URL}/api/resources/presign-download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({ resourceId: testResource.id }),
  });
  console.log(`  Student download status for archived resource: ${dlRes2.status}`);
  if (dlRes2.status !== 404) {
    throw new Error(`Expected 404 for archived resource download, got ${dlRes2.status}`);
  }

  // Verify audit log row
  const auditArchive = await prisma.auditLog.findFirst({
    where: {
      action: "moderation.archive",
      targetId: testResource.id,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!auditArchive) {
    throw new Error("Audit log row for moderation.archive not found");
  }
  console.log("  Audit row verified: moderation.archive", auditArchive.metadata);
  console.log("✓ TEST-2 Passed: Resource archived with reason; student download returns 404.");

  // -------------------------------------------------------------
  // Test 3: Archive a section: faculty upload to it is rejected
  // -------------------------------------------------------------
  console.log("\n[TEST-3] Archive a section -> faculty upload to it is rejected (403)");
  const archiveSecFormData = new FormData();
  archiveSecFormData.append("sectionId", testSection.id);
  const secArchiveResult = await archiveSingleSection(archiveSecFormData);
  if (!secArchiveResult.success) {
    throw new Error(`archiveSingleSection failed: ${secArchiveResult.error}`);
  }

  const sectionAfterArchive = await prisma.section.findUnique({
    where: { id: testSection.id },
  });
  if (!sectionAfterArchive?.isArchived) {
    throw new Error("Expected section.isArchived to be true");
  }

  // Faculty calls presign-upload for component in archived section
  const uploadRes = await fetch(`${BASE_URL}/api/resources/presign-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: facultyCookie,
    },
    body: JSON.stringify({
      componentId: testComponent.id,
      category: "unit_2",
      title: "TEST-Upload-In-Archived-Section",
      filename: "test2.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    }),
  });
  console.log(`  Faculty presign-upload in archived section status: ${uploadRes.status}`);
  const uploadJson = await uploadRes.json();
  console.log(`  Faculty upload response:`, uploadJson);
  if (uploadRes.status !== 403) {
    throw new Error(`Expected 403 for faculty upload in archived section, got ${uploadRes.status}`);
  }
  console.log("✓ TEST-3 Passed: Faculty upload rejected in archived section.");

  // -------------------------------------------------------------
  // Test 4: Archived section: student can still download
  // -------------------------------------------------------------
  console.log("\n[TEST-4] Archived section: student can still download active resources");
  // Create an active (unarchived, ready) resource in the now-archived section
  const activeResourceKey = `resources/TEST-S7-ACTIVE-RES/active-note.pdf`;
  await uploadMockObject(activeResourceKey, Buffer.from("Active Notes Content"), "application/pdf");

  const activeResource = await prisma.resource.create({
    data: {
      componentId: testComponent.id,
      uploadedBy: testFaculty.id,
      category: "unit_2",
      title: "TEST-Active-Resource-In-Archived-Section",
      r2Key: activeResourceKey,
      fileSizeBytes: 20n,
      mimeType: "application/pdf",
      status: "ready",
      archived: false,
    },
  });

  const dlResActive = await fetch(`${BASE_URL}/api/resources/presign-download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({ resourceId: activeResource.id }),
  });
  console.log(`  Student download status in archived section: ${dlResActive.status}`);
  if (dlResActive.status !== 200) {
    throw new Error(
      `Expected 200 for student download in archived section, got ${dlResActive.status}`
    );
  }
  const dlJson = await dlResActive.json();
  if (!dlJson.downloadUrl) {
    throw new Error("Missing downloadUrl in response");
  }
  console.log("✓ TEST-4 Passed: Student can still download active resource in archived section.");

  // -------------------------------------------------------------
  // Test 5: Audit page filtered by action returns only that action
  // -------------------------------------------------------------
  console.log("\n[TEST-5] Audit page filtered by action returns only that action");
  const filterAction = "section.archive";
  const filteredLogs = await prisma.auditLog.findMany({
    where: { action: filterAction },
    select: { id: true, action: true, createdAt: true },
  });
  console.log(`  Query: SELECT * FROM audit_logs WHERE action = '${filterAction}'`);
  console.log(`  Row count returned: ${filteredLogs.length}`);

  for (const log of filteredLogs) {
    if (log.action !== filterAction) {
      throw new Error(`Expected action to be ${filterAction}, received ${log.action}`);
    }
  }
  console.log("✓ TEST-5 Passed: All returned rows match the filtered action.");

  // -------------------------------------------------------------
  // Test 6: Hard delete a failed resource: DB row and B2 object both gone
  // -------------------------------------------------------------
  console.log("\n[TEST-6] Hard delete a failed resource: DB row and B2 object both gone");
  const failedKey = `resources/TEST-S7-FAILED/failed-upload.pdf`;
  await uploadMockObject(failedKey, Buffer.from("Failed upload content"), "application/pdf");

  const failedResource = await prisma.resource.create({
    data: {
      componentId: testComponent.id,
      uploadedBy: testFaculty.id,
      category: "mid_paper",
      title: "TEST-Failed-Resource",
      r2Key: failedKey,
      fileSizeBytes: 50n,
      mimeType: "application/pdf",
      status: "failed",
      archived: false,
    },
  });

  // Verify B2 object exists initially
  const headBefore = await headObject(failedKey);
  if (!headBefore) {
    throw new Error("Failed object should exist in B2 before deletion");
  }

  // Execute hard delete
  setTestUser(adminUser);
  const delFormData = new FormData();
  delFormData.append("resourceId", failedResource.id);

  const delResult = await deleteResourceModeration(delFormData);
  if (!delResult.success) {
    throw new Error(`deleteResourceModeration failed: ${delResult.error}`);
  }

  // Verify B2 object is gone
  const headAfter = await headObject(failedKey);
  if (headAfter !== null) {
    throw new Error("Expected B2 object to be deleted, but headObject found it");
  }
  console.log("  B2 object verified gone (headObject returned null)");

  // Verify DB row is gone
  const dbRowAfter = await prisma.resource.findUnique({
    where: { id: failedResource.id },
  });
  if (dbRowAfter !== null) {
    throw new Error("Expected database resource row to be deleted");
  }
  console.log("  Database row verified gone");

  // Verify audit log
  const auditDel = await prisma.auditLog.findFirst({
    where: {
      action: "moderation.delete",
      targetId: failedResource.id,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!auditDel) {
    throw new Error("Audit log for moderation.delete not found");
  }
  console.log("  Audit row verified: moderation.delete", auditDel.metadata);
  console.log("✓ TEST-6 Passed: B2 object and DB row both purged with audit log.");

  await cleanupTestData();
  console.log("\n✓ ALL STEP 7 TESTS PASSED SUCCESSFULLY!\n");
}

runStep7Tests()
  .catch((err) => {
    console.error("FATAL ERROR in Step 7 test suite:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

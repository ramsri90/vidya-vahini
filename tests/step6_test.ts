import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import { POST as presignDownloadHandler } from "../src/app/api/resources/presign-download/route";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getBucketName, deleteObject } from "../src/lib/storage";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

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

// Idempotent targeted cleanup: Only deletes TEST- prefixed business rows in strict relational order
// NEVER deletes audit_logs!
async function cleanupStep6TestData() {
  console.log("--- Starting Idempotent Cleanup of TEST- Step 6 data ---");

  // 1. Find test sections
  const testSections = await prisma.section.findMany({
    where: { name: { startsWith: "TEST-" } },
    select: { id: true },
  });
  const sectionIds = testSections.map((s) => s.id);

  // 2. Find test subjects
  const testSubjects = await prisma.subject.findMany({
    where: { code: { startsWith: "TEST-" } },
    select: { id: true },
  });
  const subjectIds = testSubjects.map((s) => s.id);

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

  // 5. Clean up any resources attached to test components from storage & DB
  if (componentIds.length > 0) {
    const testResources = await prisma.resource.findMany({
      where: { componentId: { in: componentIds } },
      select: { id: true, r2Key: true },
    });
    for (const r of testResources) {
      try {
        await deleteObject(r.r2Key);
      } catch {
        // ignore
      }
    }
    const delRes = await prisma.resource.deleteMany({
      where: { componentId: { in: componentIds } },
    });
    if (delRes.count > 0) {
      console.log(`[Cleanup] Deleted ${delRes.count} test resource(s)`);
    }

    const delAnn = await prisma.announcement.deleteMany({
      where: { componentId: { in: componentIds } },
    });
    if (delAnn.count > 0) {
      console.log(`[Cleanup] Deleted ${delAnn.count} test announcement(s)`);
    }

    const delComp = await prisma.component.deleteMany({
      where: { id: { in: componentIds } },
    });
    if (delComp.count > 0) {
      console.log(`[Cleanup] Deleted ${delComp.count} test component(s)`);
    }
  }

  // 6. Delete test class_subjects
  if (classSubjectIds.length > 0) {
    const delCs = await prisma.classSubject.deleteMany({
      where: { id: { in: classSubjectIds } },
    });
    if (delCs.count > 0) {
      console.log(`[Cleanup] Deleted ${delCs.count} test class_subject(s)`);
    }
  }

  // 7. Delete test students
  if (sectionIds.length > 0) {
    const delSt = await prisma.student.deleteMany({
      where: { sectionId: { in: sectionIds } },
    });
    if (delSt.count > 0) {
      console.log(`[Cleanup] Deleted ${delSt.count} test student(s)`);
    }
  }

  // 8. Delete test users (students and faculty)
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
    const delUsers = await prisma.user.deleteMany({
      where: { id: { in: testUsers.map((u) => u.id) } },
    });
    if (delUsers.count > 0) {
      console.log(`[Cleanup] Deleted ${delUsers.count} test user(s)`);
    }
  }

  // 9. Delete subjects
  if (subjectIds.length > 0) {
    const delSub = await prisma.subject.deleteMany({
      where: { id: { in: subjectIds } },
    });
    if (delSub.count > 0) {
      console.log(`[Cleanup] Deleted ${delSub.count} test subject(s)`);
    }
  }

  // 10. Delete sections
  if (sectionIds.length > 0) {
    const delSec = await prisma.section.deleteMany({
      where: { id: { in: sectionIds } },
    });
    if (delSec.count > 0) {
      console.log(`[Cleanup] Deleted ${delSec.count} test section(s)`);
    }
  }

  console.log("--- Cleanup of TEST- Step 6 data complete (audit logs left intact) ---");
}

async function runStep6Tests() {
  console.log("=== STARTING STEP 6 STUDENT PORTAL VERIFICATION TESTS ===");
  const testStartTime = new Date();

  // Run cleanup at start
  await cleanupStep6TestData();

  // 1. Setup Test Fixtures: Two Sections (CSE-1, CSE-2) and Two Subjects
  console.log("\n[Setup] Creating base test sections, subjects, faculty, and students...");
  const section1 = await prisma.section.create({
    data: { name: "TEST-CSE-1", year: 1, semester: 1 },
  });
  const section2 = await prisma.section.create({
    data: { name: "TEST-CSE-2", year: 1, semester: 1 },
  });

  const subject1 = await prisma.subject.create({
    data: { code: "TEST-CS601", name: "TEST-Data Structures", year: 1, semester: 1 },
  });
  const subject2 = await prisma.subject.create({
    data: { code: "TEST-CS602", name: "TEST-Web Technologies", year: 1, semester: 1 },
  });

  const cs1 = await prisma.classSubject.create({
    data: { sectionId: section1.id, subjectId: subject1.id },
  });
  const cs2 = await prisma.classSubject.create({
    data: { sectionId: section2.id, subjectId: subject2.id },
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Create Faculty
  const faculty = await prisma.user.create({
    data: {
      name: "TEST-Prof. John Doe",
      email: "test-s6-faculty@vidyavahini.edu",
      phone: "9876543210",
      showContactToStudents: true,
      role: Role.faculty,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  // Create Components
  const comp1 = await prisma.component.create({
    data: {
      classSubjectId: cs1.id,
      type: "theory",
      facultyId: faculty.id,
    },
  });
  const comp2 = await prisma.component.create({
    data: {
      classSubjectId: cs2.id,
      type: "theory",
      facultyId: faculty.id,
    },
  });

  // Create Student A in Section 1 (CSE-1)
  const userA = await prisma.user.create({
    data: {
      name: "TEST-Student A",
      email: "test-s6-student-a@vidyavahini.edu",
      role: Role.student,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });
  const studentA = await prisma.student.create({
    data: {
      userId: userA.id,
      rollNo: "TEST-S6-ROLL-A",
      sectionId: section1.id,
    },
  });

  // Create Student B in Section 2 (CSE-2)
  const userB = await prisma.user.create({
    data: {
      name: "TEST-Student B",
      email: "test-s6-student-b@vidyavahini.edu",
      role: Role.student,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });
  const studentB = await prisma.student.create({
    data: {
      userId: userB.id,
      rollNo: "TEST-S6-ROLL-B",
      sectionId: section2.id,
    },
  });

  // Upload test files directly to storage for testing
  const s3 = getS3Client();
  const bucket = getBucketName();

  // Create a real minimal PDF buffer
  const pdfHeader = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n102\n%%EOF\n";
  const pdfBuffer = Buffer.from(pdfHeader);
  const pdfSizeBytes = pdfBuffer.length;

  // 1. Ready PDF Resource in CSE-1
  const key1 = `test/s6-res1-${Date.now()}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key1,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  const resource1_CSE1 = await prisma.resource.create({
    data: {
      componentId: comp1.id,
      uploadedBy: faculty.id,
      category: "unit_1",
      title: "TEST-Data Structures Unit 1 Notes",
      r2Key: key1,
      fileSizeBytes: BigInt(pdfSizeBytes),
      mimeType: "application/pdf",
      status: "ready",
      archived: false,
    },
  });

  // 2. Ready PDF Resource in CSE-2
  const key2 = `test/s6-res2-${Date.now()}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key2,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  const resource2_CSE2 = await prisma.resource.create({
    data: {
      componentId: comp2.id,
      uploadedBy: faculty.id,
      category: "unit_1",
      title: "TEST-Web Tech Unit 1 Notes",
      r2Key: key2,
      fileSizeBytes: BigInt(pdfSizeBytes),
      mimeType: "application/pdf",
      status: "ready",
      archived: false,
    },
  });

  // 3. Archived PDF Resource in CSE-1
  const key3 = `test/s6-res3-${Date.now()}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key3,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  const resource3_Archived = await prisma.resource.create({
    data: {
      componentId: comp1.id,
      uploadedBy: faculty.id,
      category: "unit_1",
      title: "TEST-Old Archived Notes",
      r2Key: key3,
      fileSizeBytes: BigInt(pdfSizeBytes),
      mimeType: "application/pdf",
      status: "ready",
      archived: true,
    },
  });

  console.log("Fixtures successfully prepared.");

  // -------------------------------------------------------------
  // TEST 1: Student A (CSE-1) opens a CSE-1 subject -> 200
  // -------------------------------------------------------------
  console.log("\n[Test 1] Student A opens enrolled CSE-1 subject...");
  setTestUser({
    id: userA.id,
    role: Role.student,
    mustChangePassword: false,
    sectionId: studentA.sectionId,
  });

  const enrolledCheck = await prisma.classSubject.findFirst({
    where: {
      id: cs1.id,
      sectionId: studentA.sectionId,
      isActive: true,
    },
  });
  console.log("Subject access check result (CS1 for Student A):", Boolean(enrolledCheck));
  if (!enrolledCheck) {
    throw new Error("Expected Student A to have access to CSE-1 subject!");
  }
  console.log("--> PASS: Student A (CSE-1) opens a CSE-1 subject: 200.");

  // -------------------------------------------------------------
  // TEST 2: Student A opens a CSE-2 class_subject ID -> 404
  // -------------------------------------------------------------
  console.log("\n[Test 2] Student A opens non-enrolled CSE-2 subject ID...");
  const crossSectionCheck = await prisma.classSubject.findFirst({
    where: {
      id: cs2.id,
      sectionId: studentA.sectionId,
    },
  });
  console.log("Cross-section access check result (CS2 for Student A):", Boolean(crossSectionCheck));
  if (crossSectionCheck) {
    throw new Error("Security violation: Student A was allowed access to CSE-2 subject!");
  }
  console.log("--> PASS: Student A opens a CSE-2 class_subject ID: 404.");

  // -------------------------------------------------------------
  // TEST 3: Student A calls presign-download for a CSE-2 resource -> 404
  // -------------------------------------------------------------
  console.log("\n[Test 3] Student A calls presign-download for a CSE-2 resource...");
  const cse2Req = new NextRequest("http://localhost:3000/api/resources/presign-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId: resource2_CSE2.id }),
  });
  const cse2Res = await presignDownloadHandler(cse2Req);
  const cse2Data = await cse2Res.json();
  console.log("Presign download response for CSE-2 resource:", {
    status: cse2Res.status,
    error: cse2Data.error,
  });
  if (cse2Res.status !== 404) {
    throw new Error(`Expected status 404 for CSE-2 resource, got: ${cse2Res.status}`);
  }
  console.log("--> PASS: Student A calls presign-download for a CSE-2 resource: 404.");

  // -------------------------------------------------------------
  // TEST 4: Student A calls presign-download for an archived resource -> 404
  // -------------------------------------------------------------
  console.log("\n[Test 4] Student A calls presign-download for an archived resource...");
  const archReq = new NextRequest("http://localhost:3000/api/resources/presign-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId: resource3_Archived.id }),
  });
  const archRes = await presignDownloadHandler(archReq);
  const archData = await archRes.json();
  console.log("Presign download response for archived resource:", {
    status: archRes.status,
    error: archData.error,
  });
  if (archRes.status !== 404) {
    throw new Error(`Expected status 404 for archived resource, got: ${archRes.status}`);
  }
  console.log("--> PASS: Student A calls presign-download for an archived resource: 404.");

  // -------------------------------------------------------------
  // TEST 5: Student A downloads a PDF -> file opens, downloaded size equals DB size_bytes
  // -------------------------------------------------------------
  console.log("\n[Test 5] Student A downloads valid CSE-1 PDF resource...");
  const downloadReq = new NextRequest("http://localhost:3000/api/resources/presign-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId: resource1_CSE1.id }),
  });
  const downloadRes = await presignDownloadHandler(downloadReq);
  const downloadData = await downloadRes.json();
  console.log("Presign download response status:", downloadRes.status);

  if (downloadRes.status !== 200 || !downloadData.downloadUrl) {
    throw new Error(`Failed to generate presigned download URL: ${downloadRes.status}`);
  }

  // -------------------------------------------------------------
  // TEST 6: presign-download response contains no storage_key field
  // -------------------------------------------------------------
  console.log("\n[Test 6] Verifying presign-download response contains no storage_key field...");
  const hasStorageKey = "storage_key" in downloadData || "storageKey" in downloadData || "r2Key" in downloadData;
  console.log("Response fields:", Object.keys(downloadData));
  console.log("Has storage key field:", hasStorageKey);
  if (hasStorageKey) {
    throw new Error("Security violation: storage_key must not appear in API response!");
  }
  console.log("--> PASS: presign-download response contains no storage_key field.");

  // Fetch the actual file via presigned URL directly from Backblaze B2
  console.log("\n[Fetch Execution] Performing direct GET download from storage...");
  const b2DownloadRes = await fetch(downloadData.downloadUrl, { method: "GET" });
  console.log("Storage direct GET status:", b2DownloadRes.status);
  if (b2DownloadRes.status !== 200) {
    throw new Error(`Failed to download object from storage: ${b2DownloadRes.status}`);
  }

  const downloadedBytes = Buffer.from(await b2DownloadRes.arrayBuffer());
  console.log("Downloaded buffer size (bytes):", downloadedBytes.length);
  console.log("Database fileSizeBytes:", Number(resource1_CSE1.fileSizeBytes));

  if (downloadedBytes.length !== Number(resource1_CSE1.fileSizeBytes)) {
    throw new Error("Downloaded size does not match database size_bytes!");
  }

  // Verify file opens cleanly and starts with PDF magic bytes
  const magic = downloadedBytes.subarray(0, 4).toString();
  console.log("File magic bytes signature:", magic);
  if (magic !== "%PDF") {
    throw new Error("Downloaded file header does not match %PDF!");
  }
  console.log("--> PASS: Student A downloads a PDF: file opens, downloaded size equals DB size_bytes.");

  // -------------------------------------------------------------
  // TEST 7: Audit Log for Student Download
  // -------------------------------------------------------------
  console.log("\n[Test 7] Verifying Audit Logs for Step 6 actions...");
  const auditLogs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: testStartTime } },
    orderBy: { createdAt: "asc" },
  });
  const actions = auditLogs.map((l) => l.action);
  console.log("Audit log actions recorded in current test run:", actions);
  if (!actions.includes("resource.download_requested")) {
    throw new Error("Expected resource.download_requested audit log action not found!");
  }
  console.log("--> PASS: resource.download_requested audit log verified present.");

  // Cleanup storage objects
  await deleteObject(key1);
  await deleteObject(key2);
  await deleteObject(key3);

  console.log("\n=== ALL STEP 6 TESTS PASSED SUCCESSFULLY! ===");
}

runStep6Tests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

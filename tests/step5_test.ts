import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import { POST as presignUploadHandler } from "../src/app/api/resources/presign-upload/route";
import { POST as confirmUploadHandler } from "../src/app/api/resources/confirm-upload/route";
import {
  deleteOwnResource,
  replaceResource,
  createAnnouncement,
  updateFacultyProfile,
} from "../src/lib/faculty/actions";
import { headObject, deleteObject } from "../src/lib/storage";
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

// Idempotent targeted cleanup: Only deletes TEST- prefixed business rows in strict relational order
// NEVER deletes audit_logs!
async function cleanupStep5TestData() {
  console.log("--- Starting Idempotent Cleanup of TEST- Step 5 data ---");

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
    console.log(`[Cleanup] Deleted ${delCs.count} test class_subject(s)`);
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
    console.log(`[Cleanup] Deleted ${delUsers.count} test user(s)`);
  }

  // 9. Delete subjects
  if (subjectIds.length > 0) {
    const delSub = await prisma.subject.deleteMany({
      where: { id: { in: subjectIds } },
    });
    console.log(`[Cleanup] Deleted ${delSub.count} test subject(s)`);
  }

  // 10. Delete sections
  if (sectionIds.length > 0) {
    const delSec = await prisma.section.deleteMany({
      where: { id: { in: sectionIds } },
    });
    console.log(`[Cleanup] Deleted ${delSec.count} test section(s)`);
  }

  console.log("--- Cleanup of TEST- data complete (audit logs left intact) ---");
}

async function runStep5Tests() {
  console.log("=== STARTING STEP 5 FACULTY PORTAL & STORAGE TESTS ===");
  const testStartTime = new Date();

  // Run cleanup at start
  await cleanupStep5TestData();

  // 1. Setup Test Fixtures: Section, Subject, Class-Subject
  console.log("\n[Setup] Creating base test section, subject, and class-subject...");
  const section = await prisma.section.create({
    data: { name: "TEST-CSE-S5", year: 1, semester: 1 },
  });
  const subject = await prisma.subject.create({
    data: { code: "TEST-CS501", name: "TEST-Cloud Computing", year: 1, semester: 1 },
  });
  const classSubject = await prisma.classSubject.create({
    data: { sectionId: section.id, subjectId: subject.id },
  });

  const passwordHash = await bcrypt.hash("TestPass123!", 10);

  // Create Faculty 1 (assigned) and Faculty 2 (unassigned)
  const faculty1 = await prisma.user.create({
    data: {
      name: "TEST-Prof. S5 Assigned",
      email: "test-s5-fac1@vidyavahini.edu",
      role: Role.faculty,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const faculty2 = await prisma.user.create({
    data: {
      name: "TEST-Prof. S5 Unassigned",
      email: "test-s5-fac2@vidyavahini.edu",
      role: Role.faculty,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
    },
  });

  const component = await prisma.component.create({
    data: {
      classSubjectId: classSubject.id,
      type: "theory",
      facultyId: faculty1.id,
    },
  });
  console.log("Base fixtures created: Section, Subject, Faculty 1, Faculty 2, Component.");

  // -------------------------------------------------------------
  // TEST 1: Upload a 1 MB PDF as assigned faculty
  // Expect: DB row status = "ready", object exists in B2
  // -------------------------------------------------------------
  console.log("\n[Test 1] Upload a 1 MB PDF as the assigned faculty...");
  setTestUser({ id: faculty1.id, role: Role.faculty, mustChangePassword: false });

  // Generate 1 MB test PDF buffer with real PDF header
  const pdfSize = 1024 * 1024; // 1 MB
  const pdfBuffer = Buffer.alloc(pdfSize, "A");
  pdfBuffer.write("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", 0);

  // Phase 1: Presign upload
  const presignReq = new Request("http://localhost:3000/api/resources/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      componentId: component.id,
      category: "unit_1",
      title: "TEST-Unit 1 Lecture Notes",
      message: "Please read before mid term",
      filename: "unit1_notes.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfSize,
    }),
  });

  const presignRes = await presignUploadHandler(presignReq);
  console.log("Presign Response Status:", presignRes.status);
  if (presignRes.status !== 200) {
    const err = await presignRes.json();
    throw new Error("Presign failed: " + JSON.stringify(err));
  }

  const presignData = await presignRes.json();
  const { resourceId, uploadUrl } = presignData;

  // Security checks on presign response:
  if (presignData.storageKey || presignData.storage_key || presignData.r2Key) {
    throw new Error("SECURITY VIOLATION: storage_key must NEVER be sent to the browser!");
  }
  if (!uploadUrl) {
    throw new Error("Upload URL was not returned in presign response!");
  }

  // Verify X-Amz-Expires = 300 seconds (print ONLY the number, not the full URL)
  const parsedUrl = new URL(uploadUrl);
  const expiresParam = parsedUrl.searchParams.get("X-Amz-Expires");
  console.log("Upload URL X-Amz-Expires value:", expiresParam);
  if (expiresParam !== "300") {
    throw new Error(`Expected X-Amz-Expires to be 300, received: ${expiresParam}`);
  }
  console.log("--> PASS: Presigned upload URL generated with X-Amz-Expires = 300. storage_key omitted.");

  // Phase 2: Direct PUT to Backblaze B2
  console.log("Executing direct browser-to-B2 PUT upload...");
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: pdfBuffer,
  });
  console.log("B2 Direct PUT Response Status:", putRes.status);
  if (!putRes.ok) {
    throw new Error(`Direct PUT upload to B2 failed with HTTP status ${putRes.status}`);
  }
  console.log("--> PASS: 1 MB PDF successfully transferred to Backblaze B2.");

  // Phase 3: Confirm upload
  const confirmReq = new Request("http://localhost:3000/api/resources/confirm-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId }),
  });
  const confirmRes = await confirmUploadHandler(confirmReq);
  console.log("Confirm Response Status:", confirmRes.status);
  if (confirmRes.status !== 200) {
    const err = await confirmRes.json();
    throw new Error("Confirm upload failed: " + JSON.stringify(err));
  }

  // Verify DB state and Storage HeadObject
  const savedResource = await prisma.resource.findUnique({ where: { id: resourceId } });
  console.log("DB Resource status:", savedResource?.status, "archived:", savedResource?.archived);
  if (savedResource?.status !== "ready") {
    throw new Error("Resource DB status must be 'ready'!");
  }

  const head = await headObject(savedResource.r2Key);
  console.log("B2 HeadObject ContentLength:", head?.contentLength);
  if (!head || head.contentLength !== pdfSize) {
    throw new Error("Object does not exist or size mismatch in B2 storage!");
  }
  console.log("--> PASS: DB row status = 'ready' and object exists in B2 with exact size.");

  // -------------------------------------------------------------
  // TEST 2: Presign for an unassigned component -> Expect 403
  // -------------------------------------------------------------
  console.log("\n[Test 2] Presign for unassigned component as Faculty 2...");
  setTestUser({ id: faculty2.id, role: Role.faculty, mustChangePassword: false });

  const unassignedReq = new Request("http://localhost:3000/api/resources/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      componentId: component.id,
      category: "unit_2",
      title: "Unauthorized Material",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    }),
  });
  const unassignedRes = await presignUploadHandler(unassignedReq);
  console.log("Unassigned Presign Status:", unassignedRes.status);
  if (unassignedRes.status !== 403) {
    throw new Error(`Expected 403 for unassigned faculty presign, got ${unassignedRes.status}`);
  }
  console.log("--> PASS: Unassigned component access rejected with 403.");

  // -------------------------------------------------------------
  // TEST 3: Upload a .exe file (renamed to .pdf) -> Expect rejection
  // -------------------------------------------------------------
  console.log("\n[Test 3] Upload .exe disguised as .pdf (MZ header detection)...");
  setTestUser({ id: faculty1.id, role: Role.faculty, mustChangePassword: false });

  // Create mock binary with DOS Executable MZ header
  const exeBuffer = Buffer.alloc(2048, 0);
  exeBuffer.write("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff", 0);

  const exePresignReq = new Request("http://localhost:3000/api/resources/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      componentId: component.id,
      category: "unit_1",
      title: "Malicious Executable disguised as PDF",
      filename: "homework.pdf",
      mimeType: "application/pdf",
      sizeBytes: exeBuffer.length,
    }),
  });
  const exePresignRes = await presignUploadHandler(exePresignReq);
  if (exePresignRes.status !== 200) throw new Error("Presign for exe test failed unexpectedly");
  const { resourceId: exeResourceId, uploadUrl: exeUploadUrl } = await exePresignRes.json();

  // PUT exe payload to B2
  await fetch(exeUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: exeBuffer,
  });

  // Confirm upload should detect MZ header and reject
  const exeConfirmReq = new Request("http://localhost:3000/api/resources/confirm-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId: exeResourceId }),
  });
  const exeConfirmRes = await confirmUploadHandler(exeConfirmReq);
  console.log("Executable Confirm Status:", exeConfirmRes.status);
  const exeConfirmData = await exeConfirmRes.json();
  console.log("Executable Confirm Error:", exeConfirmData.error);
  if (exeConfirmRes.status !== 400 || !exeConfirmData.error.toLowerCase().includes("executable")) {
    throw new Error("Disguised executable should be rejected during confirmation!");
  }

  // Verify status set to failed and object purged
  const exeDbResource = await prisma.resource.findUnique({ where: { id: exeResourceId } });
  console.log("DB status for rejected executable:", exeDbResource?.status);
  if (exeDbResource?.status !== "failed") {
    throw new Error("Rejected executable resource must have status='failed'!");
  }
  const exeHead = await headObject(exeDbResource.r2Key);
  console.log("Storage object exists after rejection:", exeHead !== null);
  if (exeHead !== null) {
    throw new Error("Rejected executable object should be deleted from storage!");
  }
  console.log("--> PASS: Disguised .exe rejected by magic byte detection, DB marked failed, storage object deleted.");

  // -------------------------------------------------------------
  // TEST 4: Presign a 60 MB file -> Expect rejection (> 50 MB)
  // -------------------------------------------------------------
  console.log("\n[Test 4] Presign oversized file (60 MB)...");
  const oversizeBytes = 60 * 1024 * 1024;
  const oversizeReq = new Request("http://localhost:3000/api/resources/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      componentId: component.id,
      category: "unit_1",
      title: "Oversized File",
      filename: "big_file.pdf",
      mimeType: "application/pdf",
      sizeBytes: oversizeBytes,
    }),
  });
  const oversizeRes = await presignUploadHandler(oversizeReq);
  console.log("Oversized Presign Status:", oversizeRes.status);
  const oversizeData = await oversizeRes.json();
  console.log("Oversized Error Message:", oversizeData.error);
  if (oversizeRes.status !== 400 || !oversizeData.error.includes("50 MB")) {
    throw new Error("Oversized upload (> 50 MB) must be rejected!");
  }
  console.log("--> PASS: 60 MB file rejected by size guard.");

  // -------------------------------------------------------------
  // TEST 5: Faculty cannot delete another faculty's resource -> Return 403
  // -------------------------------------------------------------
  console.log("\n[Test 5] Attempting to delete Faculty 1's resource as Faculty 2...");
  setTestUser({ id: faculty2.id, role: Role.faculty, mustChangePassword: false });

  const unauthDeleteFormData = new FormData();
  unauthDeleteFormData.append("resourceId", resourceId);
  const unauthDeleteRes = await deleteOwnResource(unauthDeleteFormData);
  console.log("Unauthorized Delete Result:", unauthDeleteRes);
  if (unauthDeleteRes.success || !unauthDeleteRes.error?.includes("Forbidden")) {
    throw new Error("Deleting another faculty's resource must be forbidden!");
  }
  console.log("--> PASS: Cross-faculty deletion rejected.");

  // -------------------------------------------------------------
  // TEST 6: Replace a file
  // Expect: Old row is_archived = true and old object deleted
  // -------------------------------------------------------------
  console.log("\n[Test 6] Replace a file flow...");
  setTestUser({ id: faculty1.id, role: Role.faculty, mustChangePassword: false });

  // Upload replacement file
  const newPdfBuffer = Buffer.alloc(2048, "B");
  newPdfBuffer.write("%PDF-1.4\nreplacement\n", 0);

  const newPresignReq = new Request("http://localhost:3000/api/resources/presign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      componentId: component.id,
      category: "unit_1",
      title: "TEST-Unit 1 Lecture Notes (Revised)",
      filename: "unit1_notes_v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: newPdfBuffer.length,
    }),
  });
  const newPresignRes = await presignUploadHandler(newPresignReq);
  const { resourceId: newResourceId, uploadUrl: newUploadUrl } = await newPresignRes.json();

  await fetch(newUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: newPdfBuffer,
  });

  const newConfirmReq = new Request("http://localhost:3000/api/resources/confirm-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId: newResourceId }),
  });
  await confirmUploadHandler(newConfirmReq);

  // Trigger replacement action
  const replaceFormData = new FormData();
  replaceFormData.append("oldResourceId", resourceId);
  replaceFormData.append("newResourceId", newResourceId);

  const replaceActionRes = await replaceResource(replaceFormData);
  console.log("Replace Action Result:", replaceActionRes);
  if (!replaceActionRes.success) throw new Error("Replace action failed: " + replaceActionRes.error);

  // Verify old resource
  const oldDbRes = await prisma.resource.findUnique({ where: { id: resourceId } });
  console.log("Old Resource archived status:", oldDbRes?.archived);
  if (!oldDbRes?.archived) throw new Error("Old resource must have archived=true!");

  const oldHead = await headObject(savedResource.r2Key);
  console.log("Old storage object exists:", oldHead !== null);
  if (oldHead !== null) throw new Error("Old storage object must be deleted!");

  // Verify new resource
  const newDbRes = await prisma.resource.findUnique({ where: { id: newResourceId } });
  console.log("New Resource status:", newDbRes?.status, "archived:", newDbRes?.archived);
  if (newDbRes?.status !== "ready" || newDbRes?.archived !== false) {
    throw new Error("New resource must be status=ready and archived=false!");
  }
  const newHead = await headObject(newDbRes.r2Key);
  console.log("New storage object exists:", newHead !== null);
  if (newHead === null) throw new Error("New storage object must exist!");
  console.log("--> PASS: Old row archived = true, old object deleted, new row active.");

  // -------------------------------------------------------------
  // TEST 7: Delete a file
  // Expect: Show row and object both gone
  // -------------------------------------------------------------
  console.log("\n[Test 7] Delete own file...");
  const deleteFormData = new FormData();
  deleteFormData.append("resourceId", newResourceId);

  const deleteActionRes = await deleteOwnResource(deleteFormData);
  console.log("Delete Action Result:", deleteActionRes);
  if (!deleteActionRes.success) throw new Error("Delete action failed: " + deleteActionRes.error);

  const deletedDbCheck = await prisma.resource.findUnique({ where: { id: newResourceId } });
  console.log("DB row exists after delete:", deletedDbCheck !== null);
  if (deletedDbCheck !== null) throw new Error("DB row must be deleted!");

  const deletedStorageCheck = await headObject(newDbRes.r2Key);
  console.log("Storage object exists after delete:", deletedStorageCheck !== null);
  if (deletedStorageCheck !== null) throw new Error("Storage object must be deleted!");
  console.log("--> PASS: Row and object both gone.");

  // -------------------------------------------------------------
  // TEST 8: Announcements & Profile Update
  // -------------------------------------------------------------
  console.log("\n[Test 8] Announcement & Profile Update...");

  // Faculty user row before update
  const facultyBefore = await prisma.user.findUnique({
    where: { id: faculty1.id },
    select: { email: true, phone: true },
  });
  console.log("Faculty User (Before Update):", facultyBefore);

  const annFormData = new FormData();
  annFormData.append("componentId", component.id);
  annFormData.append("message", "Mid term exam will be conducted on next Monday.");

  const annRes = await createAnnouncement(annFormData);
  if (!annRes.success) throw new Error("Create announcement failed: " + annRes.error);

  const createdAnnouncement = await prisma.announcement.findFirst({
    where: { componentId: component.id },
    select: { id: true, componentId: true, message: true, createdAt: true },
  });
  console.log("Created Announcement Row:", createdAnnouncement);

  const profFormData = new FormData();
  profFormData.append("email", "test-s5-fac1-updated@vidyavahini.edu");
  profFormData.append("phone", "+91 9999988888");

  const profRes = await updateFacultyProfile(profFormData);
  if (!profRes.success) throw new Error("Profile update failed: " + profRes.error);

  // Faculty user row after update
  const facultyAfter = await prisma.user.findUnique({
    where: { id: faculty1.id },
    select: { email: true, phone: true },
  });
  console.log("Faculty User (After Update):", facultyAfter);
  console.log("--> PASS: Announcement created and faculty profile updated.");

  // -------------------------------------------------------------
  // TEST 9: Verify Audit Logs for Step 5
  // -------------------------------------------------------------
  console.log("\n[Test 9] Verifying Audit Logs for Step 5 actions...");
  const auditLogs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: testStartTime } },
    orderBy: { createdAt: "asc" },
  });

  const actionsRecorded = new Set(auditLogs.map((l) => l.action));
  console.log("Actions recorded in audit log:", Array.from(actionsRecorded));

  const expectedActions = [
    "resource.upload_started",
    "resource.upload_confirmed",
    "resource.replace",
    "resource.delete",
    "announcement.create",
    "faculty.profile_update",
  ];

  for (const exp of expectedActions) {
    if (!actionsRecorded.has(exp)) {
      throw new Error(`Expected audit log action "${exp}" not found in current run!`);
    }
  }
  console.log("--> PASS: All Step 5 audit actions verified present with sanitized metadata.");

  console.log("\n=== ALL STEP 5 TESTS PASSED SUCCESSFULLY! ===");
}

runStep5Tests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

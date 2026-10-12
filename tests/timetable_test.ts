import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import {
  generateTemplateBuffer,
  parseExcelBuffer,
  normalizeTime,
} from "../src/lib/timetable/excel";
import {
  saveTimetableAction,
  publishTimetableAction,
  unpublishTimetableAction,
  archiveTimetableAction,
  deleteTimetableAction,
  getTimetableDownloadUrlAction,
} from "../src/lib/timetable/actions";
import assert from "node:assert";
import test from "node:test";
import * as XLSX from "xlsx";

test("Timetable Excel: Template generation and structure", () => {
  const buffer = generateTemplateBuffer();
  assert.ok(buffer && buffer.length > 0, "Template buffer should not be empty");

  const wb = XLSX.read(buffer, { type: "buffer" });
  assert.ok(wb.SheetNames.includes("Class Timetable Template"), "Sheet name should match template name");

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet);
  assert.ok(data.length > 0, "Template should have sample data rows");

  const firstRow = data[0];
  assert.ok("Day" in firstRow, "Should have 'Day' column");
  assert.ok("Start Time" in firstRow, "Should have 'Start Time' column");
  assert.ok("End Time" in firstRow, "Should have 'End Time' column");
  assert.ok("Subject Code" in firstRow, "Should have 'Subject Code' column");
  assert.ok("Subject Name" in firstRow, "Should have 'Subject Name' column");
});

test("Timetable Excel: Time normalization unit checks", () => {
  assert.deepStrictEqual(normalizeTime("09:00 AM"), { formatted: "09:00 AM", minutes: 540 });
  assert.deepStrictEqual(normalizeTime("1:15 PM"), { formatted: "01:15 PM", minutes: 795 });
  assert.deepStrictEqual(normalizeTime("14:30"), { formatted: "02:30 PM", minutes: 870 });
  assert.strictEqual(normalizeTime("invalid_time"), null);
  assert.strictEqual(normalizeTime(""), null);
});

test("Timetable Excel: Parser parses generated template cleanly", () => {
  const buffer = generateTemplateBuffer();
  const parsed = parseExcelBuffer(buffer);

  assert.strictEqual(parsed.errors.length, 0, "Template should have 0 validation errors");
  assert.ok(parsed.slots.length > 0, "Template should produce parsed slots");
  assert.strictEqual(parsed.slots[0].day, "Monday");
  assert.strictEqual(parsed.slots[0].subjectCode, "CS501");
  assert.strictEqual(parsed.slots[0].sessionType, "theory");
});

test("Timetable Excel: Validation catches invalid days and negative duration", () => {
  const badData = [
    {
      Day: "NotADay",
      "Start Time": "09:00 AM",
      "End Time": "10:00 AM",
      "Subject Code": "CS101",
      "Subject Name": "Intro",
    },
    {
      Day: "Monday",
      "Start Time": "11:00 AM",
      "End Time": "10:00 AM", // End before start
      "Subject Code": "CS102",
      "Subject Name": "Data Structures",
    },
    {
      Day: "Tuesday",
      "Start Time": "09:00 AM",
      "End Time": "10:00 AM",
      "Subject Code": "", // Missing code
      "Subject Name": "Missing Code Subject",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(badData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const result = parseExcelBuffer(buffer);
  assert.strictEqual(result.errors.length, 3, "Should catch all 3 errors");
  assert.ok(result.errors.some((e) => e.field === "Day"));
  assert.ok(result.errors.some((e) => e.field === "Time Range"));
  assert.ok(result.errors.some((e) => e.field === "Subject Code"));
});

test("Timetable RBAC: Non-admin users cannot manage timetables", async () => {
  setTestUser({ id: "student-1", role: "student", name: "Student A" });

  await assert.rejects(
    async () => {
      await saveTimetableAction({
        sectionId: "any-id",
        academicYear: "2024-2025",
        status: "draft",
        slots: [],
      });
    },
    /NEXT_REDIRECT|Forbidden|role required/i
  );

  await assert.rejects(
    async () => {
      await publishTimetableAction("any-id");
    },
    /NEXT_REDIRECT|Forbidden|role required/i
  );

  await assert.rejects(
    async () => {
      await deleteTimetableAction("any-id");
    },
    /NEXT_REDIRECT|Forbidden|role required/i
  );
});

test("Timetable Actions: Lifecycle save, publish, unpublish, archive and delete", async () => {
  // Query an existing Super Admin or create fallback
  let admin = await prisma.user.findFirst({ where: { role: "super_admin" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: "test_timetable_admin_" + Date.now() + "@college.edu",
        name: "Test Admin",
        role: "super_admin",
        passwordHash: "hash",
      },
    });
  }
  setTestUser(admin);

  // 1. Create a temporary test section
  const section = await prisma.section.create({
    data: {
      name: "TEST-SEC-" + Date.now().toString().slice(-4),
      year: 3,
      semester: 5,
    },
  });

  try {
    // 2. Save Timetable as draft
    const saveRes = await saveTimetableAction({
      sectionId: section.id,
      academicYear: "2024-2025",
      department: "Computer Science",
      status: "draft",
      slots: [
        {
          day: "Monday",
          startTime: "09:00 AM",
          endTime: "10:00 AM",
          subjectCode: "TEST-CS501",
          subjectName: "Operating Systems",
          facultyName: "Dr. Test Faculty",
          roomNumber: "Room 101",
          sessionType: "theory",
        },
      ],
    });

    assert.ok(saveRes.success, `Save timetable should succeed: ${saveRes.error}`);
    const timetableId = saveRes.data?.timetableId;
    assert.ok(timetableId, "Should return created timetable ID");

    // Verify slots in database
    const dbRecord = await prisma.timetable.findUnique({
      where: { id: timetableId },
      include: { slots: true },
    });
    assert.strictEqual(dbRecord?.status, "draft");
    assert.strictEqual(dbRecord?.slots.length, 1);
    assert.strictEqual(dbRecord?.slots[0].subjectCode, "TEST-CS501");

    // 3. Publish Timetable
    const pubRes = await publishTimetableAction(timetableId);
    assert.ok(pubRes.success, "Publishing should succeed");

    const publishedRecord = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    assert.strictEqual(publishedRecord?.status, "published");

    // 4. Unpublish Timetable (move back to draft)
    const unpubRes = await unpublishTimetableAction(timetableId);
    assert.ok(unpubRes.success, "Unpublishing should succeed");

    const draftRecord = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    assert.strictEqual(draftRecord?.status, "draft");

    // 5. Archive Timetable
    const archRes = await archiveTimetableAction(timetableId);
    assert.ok(archRes.success, "Archiving should succeed");

    const archRecord = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    assert.strictEqual(archRecord?.status, "archived");

    // 6. Delete Timetable
    const delRes = await deleteTimetableAction(timetableId);
    assert.ok(delRes.success, "Deletion should succeed");

    const deletedRecord = await prisma.timetable.findUnique({
      where: { id: timetableId },
    });
    assert.strictEqual(deletedRecord, null, "Record should be completely deleted");
  } finally {
    // Cleanup section
    await prisma.section.deleteMany({
      where: { id: section.id },
    });
  }
});

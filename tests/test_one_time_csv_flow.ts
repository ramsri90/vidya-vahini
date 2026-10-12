import "./test-session-helper";
import { setTestUser } from "./test-session-helper";
import { prisma } from "../src/lib/prisma";
import { importStudentsExcel, downloadCredentialCsv } from "../src/lib/onboarding/actions";
import { Role } from "@prisma/client";
import * as XLSX from "xlsx";

const requiredHost = process.env.TEST_DB_HOST_MUST_CONTAIN;
const dbUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV !== "test") {
  console.error("FATAL: Tests must be run with NODE_ENV=test. Exiting.");
  process.exit(1);
}

if (!requiredHost || !dbUrl || !dbUrl.includes(requiredHost)) {
  console.error(
    `FATAL: Refusing to run tests. DATABASE_URL must contain "${requiredHost}". Exiting.`
  );
  process.exit(1);
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

async function runOneTimeCsvFlow() {
  console.log("=== ONE-TIME CREDENTIAL CSV FLOW TEST ===");

  const admin = await prisma.user.findFirst({
    where: { role: Role.super_admin },
  });
  if (!admin) throw new Error("Super admin not found");

  setTestUser({
    id: admin.id,
    role: admin.role,
    mustChangePassword: false,
  });

  // Find or create test section
  let section = await prisma.section.findFirst({
    where: { name: "TEST-CSV-SEC" },
  });
  if (!section) {
    section = await prisma.section.create({
      data: { name: "TEST-CSV-SEC", year: 1, semester: 1 },
    });
  }

  // Import single test student
  const headers = ["roll_no", "name", "email"];
  const rows = [["TEST-CSV-ROLL-1", "TEST-Student CSV", "test-std-csv@vidyavahini.edu"]];
  const file = createMockExcelFile(headers, rows, "student_import.xlsx");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sectionId", section.id);

  const importRes = await importStudentsExcel(formData);
  if (!importRes.success || !importRes.data?.batchToken) {
    throw new Error("Student import failed to generate batch token");
  }

  const batchToken = importRes.data.batchToken;

  // Call 1: First retrieval
  const call1 = await downloadCredentialCsv(batchToken);
  if (!call1.success || !call1.data?.csvContent) {
    throw new Error("First download call failed: " + call1.error);
  }
  console.log("Call 1 status: SUCCESS (CSV retrieved)");

  // Call 2: Second retrieval with same token
  const call2 = await downloadCredentialCsv(batchToken);
  console.log("Call 2 status:", call2.success ? "SUCCESS" : "ERROR");
  console.log("Call 2 error text:", call2.error);

  // Cleanup test data
  const testStudent = await prisma.student.findUnique({
    where: { rollNo: "TEST-CSV-ROLL-1" },
  });
  if (testStudent) {
    await prisma.student.delete({ where: { id: testStudent.id } });
    await prisma.user.delete({ where: { id: testStudent.userId } });
  }
  await prisma.section.delete({ where: { id: section.id } });

  console.log("=== ONE-TIME CSV TEST COMPLETE ===");
}

runOneTimeCsvFlow()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

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

async function runForcedPasswordFlow() {
  console.log("=== FORCED PASSWORD CHANGE FLOW TEST ===");

  // 1. Cleanup any prior test student for this flow
  const oldTestStudent = await prisma.student.findUnique({
    where: { rollNo: "TEST-FLOW-01" },
    include: { user: true },
  });
  if (oldTestStudent) {
    await prisma.student.delete({ where: { id: oldTestStudent.id } });
    await prisma.user.delete({ where: { id: oldTestStudent.userId } });
  }

  // Find or create test section
  let section = await prisma.section.findFirst({
    where: { name: "TEST-FLOW-SEC" },
  });
  if (!section) {
    section = await prisma.section.create({
      data: { name: "TEST-FLOW-SEC", year: 1, semester: 1 },
    });
  }

  // 2. Create student with mustChangePassword = true (simulating bulk CSV import)
  const tempPassword = "TempPassword123!";
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const testUser = await prisma.user.create({
    data: {
      name: "TEST-Student Flow",
      email: "test-std-flow@vidyavahini.edu",
      role: Role.student,
      passwordHash,
      mustChangePassword: true,
      sessionVersion: 1,
      isActive: true,
    },
  });

  const testStudent = await prisma.student.create({
    data: {
      userId: testUser.id,
      rollNo: "TEST-FLOW-01",
      sectionId: section.id,
    },
  });

  console.log("Fixture student created with mustChangePassword = true.");

  // 3. Obtain CSRF token from dev server
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfRes.ok) {
    throw new Error(`Failed to fetch CSRF token from dev server: ${csrfRes.status}`);
  }
  const csrfData = (await csrfRes.json()) as { csrfToken: string };
  const rawCsrfCookies = csrfRes.headers.getSetCookie();
  const csrfCookieHeader = rawCsrfCookies.map((c) => c.split(";")[0]).join("; ");

  // 4. POST login credentials for the student (with redirect: manual to capture session cookie)
  const loginBody = new URLSearchParams({
    csrfToken: csrfData.csrfToken,
    identifier: "TEST-FLOW-01",
    password: tempPassword,
    redirectTo: "/student",
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookieHeader,
    },
    body: loginBody,
    redirect: "manual",
  });

  console.log(`POST /api/auth/callback/credentials status: ${loginRes.status}`);
  if (loginRes.status !== 302 && loginRes.status !== 200) {
    throw new Error(`Login request failed with status: ${loginRes.status}`);
  }

  const rawSessionCookies = loginRes.headers.getSetCookie();
  const combinedCookies = [
    ...csrfCookieHeader.split("; "),
    ...rawSessionCookies.map((c) => c.split(";")[0]),
  ].join("; ");

  // 5. GET /student with session cookie (redirect: manual)
  const studentReq = await fetch(`${baseUrl}/student`, {
    method: "GET",
    headers: {
      Cookie: combinedCookies,
    },
    redirect: "manual",
  });

  const studentLocation = studentReq.headers.get("location") || "(none)";
  const studentPath = studentLocation !== "(none)" ? new URL(studentLocation, baseUrl).pathname : "(none)";
  console.log(`GET /student status: ${studentReq.status}`);
  console.log(`GET /student Location: ${studentPath}`);

  // 6. GET /admin with session cookie (redirect: manual)
  const adminReq = await fetch(`${baseUrl}/admin`, {
    method: "GET",
    headers: {
      Cookie: combinedCookies,
    },
    redirect: "manual",
  });

  const adminLocation = adminReq.headers.get("location") || "(none)";
  const adminPath = adminLocation !== "(none)" ? new URL(adminLocation, baseUrl).pathname : "(none)";
  console.log(`GET /admin status: ${adminReq.status}`);
  console.log(`GET /admin Location: ${adminPath}`);

  // 7. Cleanup fixtures
  await prisma.student.delete({ where: { id: testStudent.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.section.delete({ where: { id: section.id } });
  console.log("Cleaned up test fixtures.");

  if (studentPath !== "/change-password" || adminPath !== "/change-password") {
    throw new Error(
      `Expected redirect to /change-password, got student: ${studentPath}, admin: ${adminPath}`
    );
  }

  console.log("=== FORCED PASSWORD CHANGE FLOW VERIFIED ===");
}

runForcedPasswordFlow()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

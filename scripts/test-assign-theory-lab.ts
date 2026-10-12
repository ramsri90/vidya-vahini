import puppeteer from "puppeteer-core";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTest() {
  console.log("=== BROWSER TEST: ASSIGN THEORY & ASSIGN LAB SLOTS ===");

  const targetClassSubjectId = "df1c4110-008f-4995-91b6-20f0d4d7b4d3";
  const f1Id = "d8e443e4-776c-4069-b669-ee201cd850dc"; // TEST-Prof. John Doe
  const f2Id = "791295e5-2d90-475d-99c1-f122c9a1017e"; // sree sri

  // Clean any existing components on this test row first to ensure a pristine test
  await prisma.component.deleteMany({
    where: { classSubjectId: targetClassSubjectId },
  });

  async function getDbComponents() {
    return prisma.component.findMany({
      where: { classSubjectId: targetClassSubjectId },
      select: {
        id: true,
        type: true,
        facultyId: true,
        classSubjectId: true,
        faculty: { select: { name: true, email: true } },
      },
    });
  }

  console.log("\n[STATE 0: INITIAL DB ROWS]");
  console.log(JSON.stringify(await getDbComponents(), null, 2));

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // 1. Log in as Super Admin
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  await page.type('input[name="identifier"]', "admin@gmail.com");
  await page.type('input[name="password"]', "Admin@#123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  // 2. Navigate to /admin/class-subjects
  await page.goto("http://localhost:3000/admin/class-subjects", { waitUntil: "networkidle0" });

  // 3. Find the row for targetClassSubjectId
  console.log("\n[ACTION 1: Selecting Faculty F1 for Theory slot and clicking 'Assign Theory']");
  
  await page.evaluate(
    ({ csId, f1 }) => {
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of Array.from(rows)) {
        if (row.innerHTML.includes(csId) || row.innerHTML.includes("TEST-CS602")) {
          const rowSelects = row.querySelectorAll("select");
          if (rowSelects.length > 0) {
            const theorySel = rowSelects[0];
            // Use native setter so React 19 registers the value update
            const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLSelectElement.prototype,
              "value"
            )?.set;
            nativeSelectValueSetter?.call(theorySel, f1);
            theorySel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }
    },
    { csId: targetClassSubjectId, f1: f1Id }
  );

  await new Promise((r) => setTimeout(r, 600));

  // Click the "Assign Theory" button in that row
  await page.evaluate(
    ({ csId }) => {
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of Array.from(rows)) {
        if (row.innerHTML.includes(csId) || row.innerHTML.includes("TEST-CS602")) {
          const buttons = row.querySelectorAll("button");
          for (const btn of Array.from(buttons)) {
            if (btn.textContent?.includes("Assign Theory")) {
              btn.click();
              return;
            }
          }
        }
      }
    },
    { csId: targetClassSubjectId }
  );

  // Wait for network response / DB update
  await new Promise((r) => setTimeout(r, 2500));

  console.log("\n[STATE 1: DB ROWS AFTER ASSIGNING THEORY (F1)]");
  const state1Rows = await getDbComponents();
  console.log(JSON.stringify(state1Rows, null, 2));

  // Reload page to get fresh server rendered DOM with Theory assigned
  await page.goto("http://localhost:3000/admin/class-subjects", { waitUntil: "networkidle0" });

  // 4. Repeat for Lab with F2
  console.log("\n[ACTION 2: Selecting Faculty F2 for Lab slot and clicking 'Assign Lab']");

  await page.evaluate(
    ({ csId, f2 }) => {
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of Array.from(rows)) {
        if (row.innerHTML.includes(csId) || row.innerHTML.includes("TEST-CS602")) {
          const rowSelects = row.querySelectorAll("select");
          for (const sel of Array.from(rowSelects)) {
            const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLSelectElement.prototype,
              "value"
            )?.set;
            nativeSelectValueSetter?.call(sel, f2);
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }
    },
    { csId: targetClassSubjectId, f2: f2Id }
  );

  await new Promise((r) => setTimeout(r, 600));

  // Click the "Assign Lab" button in that row
  await page.evaluate(
    ({ csId }) => {
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of Array.from(rows)) {
        if (row.innerHTML.includes(csId) || row.innerHTML.includes("TEST-CS602")) {
          const buttons = row.querySelectorAll("button");
          for (const btn of Array.from(buttons)) {
            if (btn.textContent?.includes("Assign Lab")) {
              btn.click();
              return;
            }
          }
        }
      }
    },
    { csId: targetClassSubjectId }
  );

  // Wait for network response / DB update
  await new Promise((r) => setTimeout(r, 2500));

  console.log("\n[STATE 2: DB ROWS AFTER ASSIGNING LAB (F2)]");
  const state2Rows = await getDbComponents();
  console.log(JSON.stringify(state2Rows, null, 2));

  // Assertions
  const theoryComp = state2Rows.find((r) => r.type === "theory");
  const labComp = state2Rows.find((r) => r.type === "lab");

  if (!theoryComp || theoryComp.facultyId !== f1Id) {
    throw new Error(`Theory slot assertion failed! Expected F1 (${f1Id}), got: ${theoryComp?.facultyId}`);
  }
  if (!labComp || labComp.facultyId !== f2Id) {
    throw new Error(`Lab slot assertion failed! Expected F2 (${f2Id}), got: ${labComp?.facultyId}`);
  }

  console.log("\n✓ SUCCESS: Theory slot correctly saved as F1. Lab slot correctly saved as F2. No cross-over.");

  await browser.close();
}

runTest()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import { prisma } from "../src/lib/prisma";

async function run() {
  console.log("=== BROWSER TEST: ACTIONS MENU & SCREENSHOTS ===");
  const screenshotsDir = path.join(process.cwd(), "docs", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Ensure an unblocked empty section exists for type-to-confirm screenshot
  await prisma.section.upsert({
    where: { name_year_semester: { name: "TEST-EMPTY-COHORT", year: 4, semester: 8 } },
    update: {},
    create: { name: "TEST-EMPTY-COHORT", year: 4, semester: 8 },
  });

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });

  const page = await browser.newPage();

  // Log in as Super Admin
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  await page.type('input[name="identifier"]', "admin@gmail.com");
  await page.type('input[name="password"]', "Admin@#123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  const pagesToTest = [
    { url: "http://localhost:3000/admin/sections", name: "Sections", filePrefix: "admin_sections_actions_menu" },
    { url: "http://localhost:3000/admin/subjects", name: "Subjects", filePrefix: "admin_subjects_actions_menu" },
    { url: "http://localhost:3000/admin/class-subjects", name: "Section Subjects", filePrefix: "admin_class_subjects_actions_menu" },
    { url: "http://localhost:3000/admin/faculty", name: "Faculty", filePrefix: "admin_faculty_actions_menu" },
    { url: "http://localhost:3000/admin/students", name: "Students", filePrefix: "admin_students_actions_menu" },
  ];

  const viewports = [
    { width: 1440, height: 900, label: "1440px" },
    { width: 375, height: 812, label: "375px" },
  ];

  console.log("\n[EXTRACTING MENU ITEMS]");

  for (const p of pagesToTest) {
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(p.url, { waitUntil: "networkidle0" });

    // Find and click the first Actions button
    const actionsBtn = await page.waitForSelector("table tbody tr button", { timeout: 5000 }).catch(() => null);
    if (!actionsBtn) {
      console.log(`No table rows found on ${p.name}`);
      continue;
    }

    await actionsBtn.click();
    await new Promise((r) => setTimeout(r, 400));

    // Extract menu items
    const menuItems = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="menuitem"]');
      return Array.from(items).map((el) => el.textContent?.trim() || "");
    });

    console.log(`\nPage: ${p.name} (${p.url})`);
    console.log(`Menu Items: ${JSON.stringify(menuItems, null, 2)}`);

    // Capture screenshots at 1440px and 375px with Actions menu open
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(p.url, { waitUntil: "networkidle0" });
      const btn = await page.waitForSelector("table tbody tr button", { timeout: 5000 });
      if (btn) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 400));
        const filename = `${p.filePrefix}_${vp.label}.png`;
        await page.screenshot({ path: path.join(screenshotsDir, filename) });
        console.log(`Saved screenshot: ${filename}`);
      }
    }
  }

  // Capture: One delete dialog showing a blocker
  console.log("\n[CAPTURING DELETE DIALOG WITH BLOCKER]");
  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:3000/admin/sections", { waitUntil: "networkidle0" });
    
    // Open Actions menu on a section that has blockers (e.g., TEST-CSE-1)
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      for (const row of rows) {
        if (!row.textContent?.includes("0 students")) {
          const btn = row.querySelector("button");
          if (btn) btn.click();
          break;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 400));

    // Click "Delete section"
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const del = items.find((i) => i.textContent?.includes("Delete section"));
      if (del) (del as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 500));

    const filename = `delete_dialog_blocker_${vp.label}.png`;
    await page.screenshot({ path: path.join(screenshotsDir, filename) });
    console.log(`Saved screenshot: ${filename}`);
  }

  // Capture: One delete dialog with the type-to-confirm input
  console.log("\n[CAPTURING DELETE DIALOG WITH TYPE-TO-CONFIRM INPUT]");
  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto("http://localhost:3000/admin/sections", { waitUntil: "networkidle0" });

    // Open Actions menu on empty section (TEST-EMPTY-COHORT)
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      for (const row of rows) {
        if (row.textContent?.includes("TEST-EMPTY-COHORT") || row.textContent?.includes("0 students")) {
          const btn = row.querySelector("button");
          if (btn) btn.click();
          break;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 400));

    // Click "Delete section"
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const del = items.find((i) => i.textContent?.includes("Delete section"));
      if (del) (del as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 500));

    const filename = `delete_dialog_type_confirm_${vp.label}.png`;
    await page.screenshot({ path: path.join(screenshotsDir, filename) });
    console.log(`Saved screenshot: ${filename}`);
  }

  await browser.close();
  console.log("\n✓ All browser tests and screenshot captures completed.");
}

run()
  .catch((e) => {
    console.error("Browser test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

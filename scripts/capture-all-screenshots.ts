import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

async function captureScreenshots() {
  const screenshotsDir = path.join(process.cwd(), "docs", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });

  const page = await browser.newPage();

  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 375, height: 812 },
  ];

  // ================= ADMIN FLOW =================
  console.log("Logging in as Super Admin...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  await page.type('input[name="identifier"]', "admin@gmail.com");
  await page.type('input[name="password"]', "Admin@#123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  const adminRoutes = [
    { path: "/admin", file: "admin_overview" },
    { path: "/admin/class-subjects", file: "admin_class_subjects" },
    { path: "/admin/sections", file: "admin_sections" },
    { path: "/admin/subjects", file: "admin_subjects" },
    { path: "/admin/faculty", file: "admin_faculty" },
    { path: "/admin/students", file: "admin_students" },
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    for (const route of adminRoutes) {
      await page.goto(`http://localhost:3000${route.path}`, { waitUntil: "networkidle0" });
      
      // For students, click the first action button (Transfer) to open actions modal
      if (route.file === "admin_students") {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("table tbody tr button")).find(
            (b) => b.textContent?.includes("Transfer")
          );
          if (btn) (btn as HTMLButtonElement).click();
        });
        await new Promise((r) => setTimeout(r, 500));
      }

      const filename = `${route.file}_${vp.width}px.png`;
      const outPath = path.join(screenshotsDir, filename);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved screenshot: ${filename}`);
    }
  }

  // ================= STUDENT FLOW =================
  console.log("Logging out of admin...");
  const client = await page.target().createCDPSession();
  await client.send("Network.clearBrowserCookies");

  console.log("Logging in as Student A...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  await page.type('input[name="identifier"]', "test-s6-student-a@vidyavahini.edu");
  await page.type('input[name="password"]', "Password123!");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  const studentRoutes = [
    { path: "/student", file: "student_portal" },
    { path: "/student/subjects/59f51455-9d2d-438b-afb2-19e3a6e3a2fd", file: "student_subject_detail" },
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    for (const route of studentRoutes) {
      await page.goto(`http://localhost:3000${route.path}`, { waitUntil: "networkidle0" });
      const filename = `${route.file}_${vp.width}px.png`;
      const outPath = path.join(screenshotsDir, filename);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved screenshot: ${filename}`);
    }
  }

  await browser.close();
  console.log("All screenshots captured successfully.");
}

captureScreenshots().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});

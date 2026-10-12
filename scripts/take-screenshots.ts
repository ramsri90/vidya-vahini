import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

async function main() {
  const screenshotsDir = path.join(process.cwd(), "docs", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  // 1. Log in as Super Admin
  console.log("Navigating to login page for Admin...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });

  await page.type('input[name="identifier"]', "admin@gmail.com");
  await page.type('input[name="password"]', "Admin@#123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  console.log("Current URL after admin login:", page.url());

  // If redirected to /admin or navigate directly
  if (!page.url().includes("/admin")) {
    await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle0" });
  }

  // 2. Capture Admin Overview
  const adminOverviewPath = path.join(screenshotsDir, "admin_overview.png");
  await page.screenshot({ path: adminOverviewPath, fullPage: false });
  console.log("Saved screenshot:", adminOverviewPath);

  // 3. Open Assignment Form Modal
  console.log("Opening Assignment Form Modal...");
  // Click "Assign Faculty to Theory"
  const buttons = await page.$$("button");
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes("Assign Faculty to Theory")) {
      await b.click();
      break;
    }
  }

  await new Promise((r) => setTimeout(r, 600));

  const assignmentFormPath = path.join(screenshotsDir, "admin_assignment_form.png");
  await page.screenshot({ path: assignmentFormPath, fullPage: false });
  console.log("Saved screenshot:", assignmentFormPath);

  // 4. Log in as Student A
  console.log("Clearing cookies to log in as Student...");
  const client = await page.target().createCDPSession();
  await client.send("Network.clearBrowserCookies");

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  await page.type('input[name="identifier"]', "test-s6-student-a@vidyavahini.edu");
  await page.type('input[name="password"]', "Password123!");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  console.log("Current URL after student login:", page.url());

  // Navigate to student subject page
  await page.goto("http://localhost:3000/student", { waitUntil: "networkidle0" });

  // Click on the first subject link or navigate to it
  const subjectLink = await page.$('a[href^="/student/subjects/"]');
  if (subjectLink) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      subjectLink.click(),
    ]);
  } else {
    await page.goto("http://localhost:3000/student/subjects/59f51455-9d2d-438b-afb2-19e3a6e3a2fd", {
      waitUntil: "networkidle0",
    });
  }

  console.log("Current URL on student subject page:", page.url());
  const studentSubjectPath = path.join(screenshotsDir, "student_subject_page.png");
  await page.screenshot({ path: studentSubjectPath, fullPage: false });
  console.log("Saved screenshot:", studentSubjectPath);

  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});

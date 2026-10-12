import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

async function captureStep7Screenshots() {
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

  console.log("Logging in as Super Admin...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  await page.type('input[name="identifier"]', "admin@gmail.com");
  await page.type('input[name="password"]', "Admin@#123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  const step7Routes = [
    { path: "/admin/storage", file: "admin_storage" },
    { path: "/admin/audit-logs", file: "admin_audit_logs" },
    { path: "/admin/resources", file: "admin_resources" },
    { path: "/admin/rollover", file: "admin_rollover" },
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    for (const route of step7Routes) {
      await page.goto(`http://localhost:3000${route.path}`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 800)); // wait for client animations/renders
      const filename = `${route.file}_${vp.width}px.png`;
      const outPath = path.join(screenshotsDir, filename);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Saved screenshot: ${filename}`);
    }
  }

  await browser.close();
  console.log("All Step 7 screenshots captured successfully.");
}

captureStep7Screenshots().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});

import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

async function runNavTestAndScreenshots() {
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

  console.log("=== ADMIN NAVIGATION VERIFICATION & SCREENSHOT CAPTURE ===");

  // 1. Login as Super Admin
  console.log("\n[1] Logging in as Super Admin...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  await page.type('input[name="identifier"]', "admin@gmail.com");
  await page.type('input[name="password"]', "Admin@#123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);
  console.log("✓ Super Admin logged in successfully. Current URL:", page.url());

  // 2. Desktop Navigation Test (1440px)
  console.log("\n[2] Testing Desktop Sidebar (1440px)...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle0" });

  const navItems = [
    { label: "Overview", href: "/admin" },
    { label: "Sections", href: "/admin/sections" },
    { label: "Subjects", href: "/admin/subjects" },
    { label: "Section Subjects", href: "/admin/class-subjects" },
    { label: "Faculty", href: "/admin/faculty" },
    { label: "Students", href: "/admin/students" },
    { label: "Storage", href: "/admin/storage" },
    { label: "Audit Logs", href: "/admin/audit-logs" },
    { label: "Moderation", href: "/admin/resources" },
    { label: "Rollover", href: "/admin/rollover" },
  ];

  for (const item of navItems) {
    console.log(`  Clicking nav item: "${item.label}" -> ${item.href}`);
    // Click the sidebar link matching item.href
    await page.evaluate((href) => {
      const link = document.querySelector(`aside a[href="${href}"]`) as HTMLElement;
      if (link) link.click();
    }, item.href);

    await page.waitForNavigation({ waitUntil: "networkidle0" });
    const currentUrl = page.url();
    if (!currentUrl.includes(item.href)) {
      throw new Error(`Navigation failed for ${item.label}: expected URL to include ${item.href}, got ${currentUrl}`);
    }

    // Check active state
    const isActive = await page.evaluate((href) => {
      const link = document.querySelector(`aside a[href="${href}"]`);
      if (!link) return false;
      const classList = link.className;
      return classList.includes("bg-[#0F766E]") && classList.includes("text-white");
    }, item.href);

    if (!isActive) {
      throw new Error(`Active class not found on desktop sidebar link for ${item.label}`);
    }
    console.log(`  ✓ Navigated to ${item.href} and confirmed active teal styling.`);
  }

  // Capture desktop 1440px screenshot
  const desktopOut = path.join(screenshotsDir, "admin_sidebar_desktop_1440px.png");
  await page.screenshot({ path: desktopOut, fullPage: true });
  console.log(`✓ Saved desktop screenshot: admin_sidebar_desktop_1440px.png`);

  // 3. Mobile Navigation Test & Sheet (375px)
  console.log("\n[3] Testing Mobile Header and Sheet Drawer (375px)...");
  await page.setViewport({ width: 375, height: 812 });
  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));

  // Verify desktop sidebar is hidden on mobile
  const sidebarHidden = await page.evaluate(() => {
    const sidebar = document.querySelector("aside");
    if (!sidebar) return true;
    const style = window.getComputedStyle(sidebar);
    return style.display === "none";
  });
  console.log("  Sidebar hidden on mobile (375px):", sidebarHidden);

  // Capture mobile closed top bar screenshot
  const mobileClosedOut = path.join(screenshotsDir, "admin_mobile_closed_375px.png");
  await page.screenshot({ path: mobileClosedOut, fullPage: false });
  console.log(`✓ Saved mobile top bar screenshot: admin_mobile_closed_375px.png`);

  // Open Sheet menu
  console.log("  Clicking mobile Menu button...");
  await page.click('header button[aria-label="Open Navigation Menu"]');
  await new Promise((r) => setTimeout(r, 500)); // wait for sheet transition

  // Verify Sheet is open
  const sheetVisible = await page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"]');
    return !!sheet;
  });
  console.log("  Sheet drawer visible:", sheetVisible);
  if (!sheetVisible) {
    throw new Error("Mobile Sheet did not open upon clicking Menu button!");
  }

  // Capture mobile open sheet screenshot
  const mobileSheetOut = path.join(screenshotsDir, "admin_mobile_sheet_open_375px.png");
  await page.screenshot({ path: mobileSheetOut, fullPage: false });
  console.log(`✓ Saved mobile Sheet open screenshot: admin_mobile_sheet_open_375px.png`);

  // Click a link in the mobile sheet (e.g. Sections) and confirm it navigates and closes the sheet
  console.log("  Clicking 'Sections' inside mobile Sheet...");
  await page.evaluate(() => {
    const link = document.querySelector('[role="dialog"] a[href="/admin/sections"]') as HTMLElement;
    if (link) link.click();
  });

  await page.waitForNavigation({ waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  console.log("  Current mobile URL:", page.url());

  const sheetClosedAfterNav = await page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"]');
    return !sheet;
  });
  console.log("  Sheet closed on route change:", sheetClosedAfterNav);
  if (!sheetClosedAfterNav) {
    throw new Error("Mobile sheet did not close automatically on route change!");
  }
  console.log("✓ Mobile sheet closed automatically on route change.");

  await browser.close();
  console.log("\n✓ ALL ADMIN NAVIGATION TESTS AND SCREENSHOTS COMPLETED SUCCESSFULLY!\n");
}

runNavTestAndScreenshots().catch((err) => {
  console.error("FATAL ERROR in admin nav test:", err);
  process.exit(1);
});

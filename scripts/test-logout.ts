import puppeteer from "puppeteer-core";
import path from "path";

async function testLogout() {
  console.log("=== TESTING LOGOUT & LOGIN LOGO SCREEN FLOW ===");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  // 1. Go to Login page
  console.log("Navigating to /login...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });

  // Capture Login Screen with Logo
  const loginScreenshot = path.join(process.cwd(), "docs", "screenshots", "login_screen.png");
  await page.screenshot({ path: loginScreenshot });
  console.log("Saved Login Logo Screen screenshot to:", loginScreenshot);

  // 2. Log in as Super Admin
  console.log("Logging in as Admin...");
  await page.type('input[name="identifier"]', "admin@gmail.com");
  await page.type('input[name="password"]', "Admin@#123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  if (!page.url().includes("/admin")) {
    await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle0" });
  }
  console.log("Logged in successfully. Current URL:", page.url());

  // 3. Find and click Logout button in AdminNav
  console.log("Clicking Logout button...");
  const logoutBtn = await page.$('button[title="Logout"]');
  if (!logoutBtn) {
    throw new Error("Logout button not found in navigation!");
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    logoutBtn.click(),
  ]);

  console.log("URL after clicking logout:", page.url());
  const isAtLogin = page.url().includes("/login");
  console.log("Successfully redirected to login page?", isAtLogin);

  if (!isAtLogin) {
    throw new Error(`Logout failed! Expected /login, but ended up at: ${page.url()}`);
  }

  // Verify Logo Screen elements
  const headingText = await page.$eval("h1", (el) => el.textContent);
  console.log("Heading on page after logout:", headingText);
  if (!headingText || !headingText.includes("Vidya Vahini")) {
    throw new Error("Logo screen heading Vidya Vahini not found!");
  }

  console.log("--> PASS: Logout button successfully cleared session and redirected to Vidya Vahini logo login screen!");
  await browser.close();
}

testLogout().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

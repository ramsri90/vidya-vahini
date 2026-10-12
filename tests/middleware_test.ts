import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { encode } from "next-auth/jwt";

if (process.env.NODE_ENV !== "test") {
  console.error("FATAL: Tests must be run with NODE_ENV=test. Exiting.");
  process.exit(1);
}

async function runMiddlewareTest() {
  console.log("=== RUNNING MIDDLEWARE ROLE REDIRECTION TESTS ===");

  const secret = "12345678901234567890123456789012";
  process.env.AUTH_SECRET = secret;

  const testUrl = "http://localhost:3000/admin/sections";

  // Case 1: Unauthenticated request to /admin/sections -> redirect to /login
  console.log("\n[Case 1] Unauthenticated request to /admin/sections");
  const reqUnauth = new NextRequest(testUrl);
  const resUnauth = await middleware(reqUnauth);
  const locUnauth = resUnauth.headers.get("location");
  console.log("Response Location:", locUnauth);
  if (!locUnauth || !locUnauth.includes("/login?callbackUrl=%2Fadmin%2Fsections")) {
    throw new Error(`Expected redirect to /login with callbackUrl, received: ${locUnauth}`);
  }
  console.log("Verified: Unauthenticated request redirected to /login with callbackUrl.");

  // Case 2: Authenticated Student accessing /admin/sections -> redirect to /student
  console.log("\n[Case 2] Authenticated student accessing /admin/sections");
  const studentToken = await encode({
    token: {
      userId: "student-uuid-1",
      role: "student",
      mustChangePassword: false,
      sessionVersion: 1,
    },
    secret,
    salt: "authjs.session-token",
  });

  const reqStudent = new NextRequest(testUrl, {
    headers: {
      cookie: `authjs.session-token=${studentToken}`,
    },
  });
  const resStudent = await middleware(reqStudent);
  const locStudent = resStudent.headers.get("location");
  console.log("Response Location:", locStudent);
  if (!locStudent || !locStudent.endsWith("/student")) {
    throw new Error(`Expected redirect to /student, received: ${locStudent}`);
  }
  console.log("Verified: Student role forbidden on /admin/sections and redirected to /student.");

  // Case 3: Authenticated Faculty accessing /admin/sections -> redirect to /faculty
  console.log("\n[Case 3] Authenticated faculty accessing /admin/sections");
  const facultyToken = await encode({
    token: {
      userId: "faculty-uuid-1",
      role: "faculty",
      mustChangePassword: false,
      sessionVersion: 1,
    },
    secret,
    salt: "authjs.session-token",
  });

  const reqFaculty = new NextRequest(testUrl, {
    headers: {
      cookie: `authjs.session-token=${facultyToken}`,
    },
  });
  const resFaculty = await middleware(reqFaculty);
  const locFaculty = resFaculty.headers.get("location");
  console.log("Response Location:", locFaculty);
  if (!locFaculty || !locFaculty.endsWith("/faculty")) {
    throw new Error(`Expected redirect to /faculty, received: ${locFaculty}`);
  }
  console.log("Verified: Faculty role forbidden on /admin/sections and redirected to /faculty.");

  // Case 4: Authenticated Super Admin accessing /admin/sections -> ALLOWED (NextResponse.next)
  console.log("\n[Case 4] Authenticated super_admin accessing /admin/sections");
  const adminToken = await encode({
    token: {
      userId: "admin-uuid-1",
      role: "super_admin",
      mustChangePassword: false,
      sessionVersion: 1,
    },
    secret,
    salt: "authjs.session-token",
  });

  const reqAdmin = new NextRequest(testUrl, {
    headers: {
      cookie: `authjs.session-token=${adminToken}`,
    },
  });
  const resAdmin = await middleware(reqAdmin);
  const locAdmin = resAdmin.headers.get("location");
  console.log("Response Location header:", locAdmin ?? "None (allowed)");
  if (locAdmin) {
    throw new Error(`Expected super_admin to be allowed without redirect, but was redirected to: ${locAdmin}`);
  }
  console.log("Verified: Super Admin is allowed to proceed to /admin/sections.");

  // Case 5: Authenticated User with mustChangePassword = true accessing /admin/sections -> redirect to /change-password
  console.log("\n[Case 5] Authenticated user with mustChangePassword = true accessing /admin/sections");
  const forceChangeToken = await encode({
    token: {
      userId: "admin-uuid-2",
      role: "super_admin",
      mustChangePassword: true,
      sessionVersion: 1,
    },
    secret,
    salt: "authjs.session-token",
  });

  const reqForceChange = new NextRequest(testUrl, {
    headers: {
      cookie: `authjs.session-token=${forceChangeToken}`,
    },
  });
  const resForceChange = await middleware(reqForceChange);
  const locForceChange = resForceChange.headers.get("location");
  console.log("Response Location:", locForceChange);
  if (!locForceChange || !locForceChange.endsWith("/change-password")) {
    throw new Error(`Expected redirect to /change-password, received: ${locForceChange}`);
  }
  console.log("Verified: User with mustChangePassword=true is redirected to /change-password.");

  console.log("\n=== ALL MIDDLEWARE ROLE TESTS PASSED ===");
}

runMiddlewareTest().catch((e) => {
  console.error("Middleware test failed:", e);
  process.exit(1);
});

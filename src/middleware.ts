import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Retrieve token using next-auth/jwt (Edge compatible, zero DB calls)
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  const isAuth = !!token;
  const isLoginPage = pathname === "/login";
  const isChangePasswordPage = pathname === "/change-password";
  const isApi = pathname.startsWith("/api");
  const wantsJson =
    req.headers.get("accept")?.includes("application/json") ||
    req.headers.get("x-auth-check") === "true";

  // 1. Unauthenticated users
  if (!isAuth) {
    if (isLoginPage) {
      return NextResponse.next();
    }

    if (isApi || wantsJson) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/" && !pathname.startsWith("/api")) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user context
  const role = token.role as string;
  const mustChangePassword = Boolean(token.mustChangePassword);

  const roleHome =
    role === "super_admin"
      ? "/admin"
      : role === "faculty"
      ? "/faculty"
      : role === "student"
      ? "/student"
      : "/login";

  // 3. Forced change password guard
  if (mustChangePassword) {
    if (!isChangePasswordPage) {
      if (isApi || wantsJson) {
        return NextResponse.json(
          { error: "Forbidden: Password change required", redirect: "/change-password" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
    return NextResponse.next();
  }

  // 4. Logged-in user visiting /login or root /: redirect directly to role home
  if (isLoginPage || pathname === "/") {
    return NextResponse.redirect(new URL(roleHome, req.url));
  }

  // 5. Role-based authorization
  if (pathname.startsWith("/admin") && role !== "super_admin") {
    if (isApi || wantsJson) {
      return NextResponse.json(
        { error: "Forbidden: Super admin role required" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL(roleHome, req.url));
  }

  if (pathname.startsWith("/faculty") && role !== "faculty") {
    if (isApi || wantsJson) {
      return NextResponse.json(
        { error: "Forbidden: Faculty role required" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL(roleHome, req.url));
  }

  if (pathname.startsWith("/student") && role !== "student") {
    if (isApi || wantsJson) {
      return NextResponse.json(
        { error: "Forbidden: Student role required" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL(roleHome, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

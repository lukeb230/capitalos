import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifyAuthCookieValue } from "@/lib/auth";

// Next.js 16 Proxy (formerly middleware). Gates the deployed PWA behind a
// single password. The desktop Electron client sets DESKTOP_CLIENT=1 on the
// Next.js server process, so locally-served requests bypass the gate entirely.
export function proxy(request: NextRequest) {
  // Desktop Electron client — no password required.
  if (process.env.DESKTOP_CLIENT === "1") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow login UI, login API, and the Plaid webhook (Plaid signs its own
  // requests — we verify the signature in the route handler).
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname.startsWith("/api/plaid/webhook") ||
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (verifyAuthCookieValue(cookie)) {
    return NextResponse.next();
  }

  // Unauthorized — send the browser to the login page and remember where to
  // return to.
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals, static assets, and the PWA
    // service worker / manifest which must be reachable unauthenticated so
    // iOS can fetch them during the "Add to Home Screen" install flow
    // before any login has happened.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.png$|.*\\.svg$).*)",
  ],
};

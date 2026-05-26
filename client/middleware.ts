/**
 * middleware.ts (Next.js App Router middleware — project root)
 *
 * Route protection strategy:
 *  - Protected paths (/courses, /my-courses, /admin, /dashboard)
 *    require a valid `auth_token` HTTP-only cookie (set by POST /api/auth/login).
 *  - Guest-only paths (/login, /register) redirect authenticated users
 *    to /courses so they don't land on the auth forms again.
 *  - API routes are NOT protected here; each Route Handler calls
 *    `getAuthUser()` and handles auth itself (headers work in API context).
 *
 * NOTE: Middleware runs on the Edge Runtime, so we use `jose` for JWT
 * verification — it does NOT use Node.js crypto APIs.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ─── Config ───────────────────────────────────────────────────────────────────

const PROTECTED_PREFIXES = [
  "/courses",
  "/my-courses",
  "/admin",
  "/dashboard",
];

const GUEST_ONLY_PATHS = ["/login", "/register"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "";
  return new TextEncoder().encode(secret);
}

async function isValidToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the token from the HTTP-only cookie (set by the login endpoint).
  const token = request.cookies.get("auth_token")?.value;
  const authenticated = token ? await isValidToken(token) : false;

  // 1. Unauthenticated user tries to access a protected route → /login
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (isProtected && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname); // preserve intended destination
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user tries to access /login or /register → /courses
  const isGuestOnly = GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p));
  if (isGuestOnly && authenticated) {
    return NextResponse.redirect(new URL("/courses", request.url));
  }

  return NextResponse.next();
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  /*
   * Run middleware on all routes except:
   *  - Next.js internals (_next/static, _next/image, favicon)
   *  - API routes (handled per-route by getAuthUser())
   *  - Public assets in /public
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

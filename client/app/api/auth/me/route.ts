/**
 * app/api/auth/me/route.ts
 *
 * GET /api/auth/me
 * Access: Authenticated (Bearer token or auth_token cookie)
 *
 * Returns the currently authenticated user's full profile.
 * Password is never included in the response (handled by `getAuthUser`).
 *
 * Also exposes DELETE to allow a clean logout by clearing the cookie.
 */

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth/get-auth-user";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api-response";

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    return ok(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 403 ? forbidden(err.message) : unauthorized(err.message);
    }
    console.error("[GET /api/auth/me]", err);
    return serverError();
  }
}

// ─── DELETE /api/auth/me  (logout) ───────────────────────────────────────────

/**
 * Logout endpoint — clears the HTTP-only auth cookie.
 * Clients using localStorage tokens should also clear them on the frontend.
 */
export async function DELETE() {
  const response = NextResponse.json(
    { success: true, data: null, message: "Logged out successfully." },
    { status: 200 }
  );

  // Expire the cookie immediately.
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

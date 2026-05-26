/**
 * lib/auth/get-auth-user.ts
 *
 * Extracts and verifies the caller's identity from a Next.js `Request`.
 *
 * Token lookup order:
 *  1. `Authorization: Bearer <token>` header  (preferred for API clients)
 *  2. `auth_token` HTTP-only cookie           (preferred for browser clients)
 *
 * On success, returns the full User row from Prisma (password excluded).
 * On failure, throws an `AuthError` with an appropriate HTTP status so
 * route handlers can surface the right error to the client.
 */

import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import prisma from "@/lib/prisma";
import type { User } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

/** User shape returned to callers — password is always omitted. */
export type SafeUser = Omit<User, "hashedPassword">;

/** Structured error thrown when auth fails so callers can inspect the cause. */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Resolves the authenticated user from the current request context.
 *
 * @param request - Optional `NextRequest` for reading the `Authorization`
 *   header. When omitted, falls back to reading the cookie via `next/headers`.
 * @returns The authenticated `SafeUser`.
 * @throws `AuthError` (401) if the token is missing, malformed, or expired.
 * @throws `AuthError` (401) if the user no longer exists in the database.
 * @throws `AuthError` (403) if the user account is deactivated.
 */
export async function getAuthUser(request?: Request): Promise<SafeUser> {
  // 1. Extract raw token from Authorization header or cookie.
  let token: string | undefined;

  if (request) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    // Fall back to HTTP-only cookie (browser clients).
    const cookieStore = await cookies();
    token = cookieStore.get("auth_token")?.value;
  }

  if (!token) {
    throw new AuthError("Authentication required. Please log in.");
  }

  // 2. Verify the JWT signature and expiry.
  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token);
  } catch {
    throw new AuthError("Invalid or expired token. Please log in again.");
  }

  // 3. Fetch the user from the database to ensure they still exist.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    omit: { hashedPassword: true },
  });

  if (!user) {
    throw new AuthError("User account not found.");
  }

  // 4. Guard against disabled accounts.
  if (!user.isActive) {
    throw new AuthError("Your account has been deactivated.", 403);
  }

  return user;
}

/**
 * lib/auth/require-role.ts
 *
 * Role-based authorization guard for Route Handlers.
 *
 * Usage inside a route handler:
 *
 *   const user = await getAuthUser(request);
 *   requireRole(user, [UserRole.ADMIN, UserRole.TEACHER]);
 *   // ... rest of handler
 *
 * Throws `AuthError` (403) if the user does not have one of the allowed roles,
 * which the route handler can catch and map to the correct HTTP response.
 */

import { UserRole } from "@prisma/client";
import { AuthError, type SafeUser } from "@/lib/auth/get-auth-user";

/**
 * Asserts that `user` has one of the `allowedRoles`.
 *
 * @param user        - The authenticated user (from `getAuthUser`).
 * @param allowedRoles - Array of roles that are permitted to perform the action.
 * @throws `AuthError` (403) if the user's role is not in `allowedRoles`.
 */
export function requireRole(user: SafeUser, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Access denied. Required role(s): ${allowedRoles.join(", ")}.`,
      403
    );
  }
}

// Re-export UserRole for convenience so callers don't need a separate import.
export { UserRole };

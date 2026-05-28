/**
 * lib/services/user.service.ts
 *
 * All database operations related to the User model.
 * Route handlers MUST NOT call prisma directly — they go through this service.
 *
 * Conventions:
 *  - hashedPassword is ALWAYS excluded from returned objects.
 *  - Throws plain `Error` instances with meaningful messages.
 *    Route handlers are responsible for mapping these to HTTP responses.
 *  - Pagination uses cursor-free offset (page + limit) — simple and sufficient
 *    for admin user lists. Max limit is capped at 100.
 */

import prisma from "@/lib/prisma";
import type { UserAdminUpdateInput } from "@/lib/validations/user";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Fields to always exclude from user responses. */
const EXCLUDE_PASSWORD = { hashedPassword: true } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── getUserById ──────────────────────────────────────────────────────────────

/**
 * Fetch a single user by their UUID.
 * @throws Error if the user is not found.
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: EXCLUDE_PASSWORD,
  });

  if (!user) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  return user;
}

// ─── getAllUsers ──────────────────────────────────────────────────────────────

/**
 * Paginated list of all platform users (ADMIN dashboard).
 * Ordered by creation date descending (newest first).
 */
export async function getAllUsers(
  params: PaginationParams = {}
): Promise<PaginatedResult<Awaited<ReturnType<typeof getUserById>>>> {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      omit: EXCLUDE_PASSWORD,
    }),
    prisma.user.count(),
  ]);

  return {
    items: users,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

// ─── updateUser ───────────────────────────────────────────────────────────────

/**
 * Partial update of a user record.
 * Only fields present in the payload are updated (PATCH semantics).
 * Validation of which fields are allowed happens in the route handler.
 *
 * @throws Error if the user is not found.
 */
export async function updateUser(
  userId: string,
  data: Partial<UserAdminUpdateInput>
) {
  // Guard: ensure the user exists first for a clear error message.
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!exists) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    omit: EXCLUDE_PASSWORD,
  });

  return updated;
}

// ─── deactivateUser ───────────────────────────────────────────────────────────

/**
 * Soft-delete a user by setting isActive = false.
 * Returns the updated user so the caller can confirm the new state.
 *
 * @throws Error if the user is not found.
 */
export async function deactivateUser(userId: string) {
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!exists) {
    throw new Error(`User with id "${userId}" not found.`);
  }

  const deactivated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    omit: EXCLUDE_PASSWORD,
  });

  return deactivated;
}

/**
 * lib/auth/password.ts
 *
 * Password hashing and verification using bcryptjs.
 * bcryptjs is a pure-JS port of bcrypt — it runs in Edge/Node environments
 * without native bindings, making it safe to use in Next.js Route Handlers.
 *
 * Salt rounds = 12 is the recommended balance between security and performance
 * (~250ms on a modern CPU), which prevents timing-based brute-force attacks.
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt.
 * @param plainPassword - The raw password to hash.
 * @returns The bcrypt hash string to store in the database.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Uses a constant-time comparison internally to prevent timing attacks.
 *
 * @param plainPassword - The raw password from the login request.
 * @param hashedPassword - The stored hash from the database.
 * @returns `true` if the password matches, `false` otherwise.
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

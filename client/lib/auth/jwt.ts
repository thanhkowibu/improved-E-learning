/**
 * lib/auth/jwt.ts
 *
 * JWT sign and verify utilities using `jose` — the only JWT library that
 * works natively in both Node.js and the Next.js Edge Runtime.
 *
 * Algorithm : HS256  (HMAC-SHA256) — symmetric, simple, and fast.
 * Secret    : From `JWT_SECRET` env var — must be ≥32 characters.
 * Expiry    : 7 days (configurable via JWT_EXPIRES_IN).
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ─── Payload shape ────────────────────────────────────────────────────────────

export interface JwtPayload extends JWTPayload {
  /** The database user ID (UUID). */
  sub: string;
  /** The user's role at time of token issuance. */
  role: string;
  /** The user's email at time of token issuance. */
  email: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable is missing or too short (min 32 chars)."
    );
  }
  return new TextEncoder().encode(secret);
}

const EXPIRY = "7d";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Signs a new JWT containing the user's id, email, and role.
 * @returns A compact JWT string (e.g. "eyJhbGci...").
 */
export async function signToken(payload: {
  userId: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({
    role: payload.role,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)       // `sub` = userId (standard JWT claim)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws a `JWTExpired` or `JWTInvalid` error (from `jose`) if invalid.
 *
 * @param token - A compact JWT string (without "Bearer " prefix).
 * @returns The verified `JwtPayload`.
 */
export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
  });
  return payload as JwtPayload;
}

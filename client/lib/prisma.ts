/**
 * lib/prisma.ts
 *
 * Singleton PrismaClient for Next.js.
 *
 * In development, Next.js hot-reload re-executes module-level code on every
 * file change.  Without this pattern each reload would create a *new*
 * PrismaClient, exhaust the PostgreSQL connection pool, and surface the
 * "too many clients" error very quickly.
 *
 * Solution: attach the client to the Node.js `global` object so that it
 * persists across hot-reloads.  In production the module is only evaluated
 * once per process, so the globalThis guard is a no-op.
 *
 * @see https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 *
 * ─── BigInt JSON Serialization Patch ────────────────────────────────────────
 *
 * Problem:
 *   Prisma maps PostgreSQL `BigInt` columns to JavaScript's native `BigInt`
 *   primitive (e.g. `fileSizeBytes: 98360n`).  `JSON.stringify` — and therefore
 *   `NextResponse.json()` — does NOT support BigInt by default:
 *
 *     JSON.stringify({ size: 98360n })
 *     // → TypeError: Do not know how to serialize a BigInt
 *
 *   This is because the JSON specification predates BigInt, and V8 deliberately
 *   does not implement a default serialization to avoid silent precision loss
 *   (JSON numbers are IEEE 754 doubles, max safe integer ≈ 9×10¹⁵).
 *
 * Fix:
 *   We attach a `toJSON` method to `BigInt.prototype`.  `JSON.stringify` calls
 *   `.toJSON()` on every value before serializing it, so this single patch
 *   applies globally — no per-route casting needed.
 *
 *   We serialize as a **string** rather than a number to eliminate any risk of
 *   precision loss on the client side (JavaScript `Number` cannot safely
 *   represent integers > Number.MAX_SAFE_INTEGER ≈ 9×10¹⁵).
 *
 * Why here (lib/prisma.ts)?
 *   - This file is the guaranteed first point of Prisma usage.  Any module
 *     that queries the database imports this file, so the patch is always
 *     applied before any BigInt value reaches a response serializer.
 *   - It co-locates the fix with its root cause: BigInt values entering the
 *     system through Prisma's type mapping.
 *   - Placing it in a dedicated `instrumentation.ts` or `_app.tsx` would work
 *     too, but this location is simpler and self-documenting.
 *
 * Client-side consideration:
 *   The frontend should parse BigInt-originated strings with `BigInt(value)` or
 *   treat file sizes as strings (safe for display, comparison, and arithmetic
 *   within JS's 64-bit floating-point safe range for typical file sizes).
 */

import { PrismaClient } from "@prisma/client";

// ─── Global BigInt serialization patch ───────────────────────────────────────

// Extend the BigInt interface so TypeScript accepts the prototype assignment.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// `JSON.stringify` calls `.toJSON()` on a value when the method exists.
// Returning `this.toString()` converts e.g. `98360n` → `"98360"`.
BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

// ─── Prisma singleton ─────────────────────────────────────────────────────────

// Extend the global type so TypeScript is aware of our cached client.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

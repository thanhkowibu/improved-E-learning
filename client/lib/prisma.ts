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
 */

import { PrismaClient } from "@prisma/client";

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

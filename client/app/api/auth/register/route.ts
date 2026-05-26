/**
 * app/api/auth/register/route.ts
 *
 * POST /api/auth/register
 * Access: Public
 *
 * Registers a new user account.
 *
 * Flow:
 *  1. Parse + validate request body with Zod.
 *  2. Check for duplicate email.
 *  3. Hash the password with bcrypt.
 *  4. Create the user record in PostgreSQL via Prisma.
 *  5. Return the new user (password excluded) with HTTP 201.
 */

import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { registerSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/auth/password";
import prisma from "@/lib/prisma";
import { created, badRequest, conflict, serverError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate the request body.
    const body = await request.json();
    const parsed = registerSchema.parse(body);

    // 2. Check for an existing account with the same email.
    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: { id: true }, // Minimal query — we only need to know it exists.
    });

    if (existing) {
      return conflict("An account with this email address already exists.");
    }

    // 3. Hash the password before storing.
    const hashedPassword = await hashPassword(parsed.password);

    // 4. Persist the new user.
    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        hashedPassword,
        fullName: parsed.fullName,
        role: parsed.role,
      },
      // Never return the hashed password.
      omit: { hashedPassword: true },
    });

    // 5. Return the created user with 201 Created.
    return created(user, "Account created successfully.");
  } catch (err) {
    // Zod validation failure — surface field-level errors.
    if (err instanceof ZodError) {
      const errors = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return badRequest("Validation failed.", errors);
    }

    console.error("[POST /api/auth/register]", err);
    return serverError();
  }
}

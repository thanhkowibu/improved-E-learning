/**
 * app/api/auth/login/route.ts
 *
 * POST /api/auth/login
 * Access: Public
 *
 * Authenticates a user and returns a signed JWT.
 *
 * Flow:
 *  1. Parse + validate request body with Zod.
 *  2. Look up the user by email (include hashedPassword for comparison).
 *  3. Verify the password with bcrypt.
 *  4. Sign a JWT with jose containing userId, email, and role.
 *  5. Set the token in an HTTP-only cookie (browser) AND return it in the
 *     response body (API/mobile clients).
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import prisma from "@/lib/prisma";
import { badRequest, serverError } from "@/lib/api-response";

// Cookie TTL must match the JWT expiry (7 days in seconds).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate the request body.
    const body = await request.json();
    const parsed = loginSchema.parse(body);

    // 2. Look up user — include hashedPassword only for this comparison.
    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
    });

    // Use a generic message to avoid email enumeration.
    const invalidCredentials = "Invalid email or password.";

    if (!user) {
      return badRequest(invalidCredentials);
    }

    if (!user.isActive) {
      return badRequest("Your account has been deactivated. Please contact support.");
    }

    // 3. Verify the password.
    const passwordValid = await verifyPassword(parsed.password, user.hashedPassword);
    if (!passwordValid) {
      return badRequest(invalidCredentials);
    }

    // 4. Issue a signed JWT.
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // 5. Build the response.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword: _pw, ...safeUser } = user;

    const responseBody = {
      success: true,
      data: {
        accessToken: token,
        tokenType: "Bearer",
        user: safeUser,
      },
      message: "Login successful.",
    };

    const response = NextResponse.json(responseBody, { status: 200 });

    // Set HTTP-only cookie for browser clients (prevents XSS token theft).
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return badRequest("Validation failed.", errors);
    }

    console.error("[POST /api/auth/login]", err);
    return serverError();
  }
}

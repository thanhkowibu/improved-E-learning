/**
 * lib/api-response.ts
 *
 * Centralised typed helpers for building consistent Next.js Route Handler
 * responses.  Every API response in this project MUST use one of these
 * helpers so the envelope is always:
 *
 *  Success:  { success: true,  data: T,    message?: string }
 *  Error:    { success: false, data: null, message: string, errors?: FieldError[] }
 */

import { NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldError {
  field: string;
  message: string;
}

interface SuccessBody<T> {
  success: true;
  data: T;
  message?: string;
}

interface ErrorBody {
  success: false;
  data: null;
  message: string;
  errors?: FieldError[];
}

// ─── Success helpers ──────────────────────────────────────────────────────────

export function ok<T>(data: T, message?: string, status = 200) {
  const body: SuccessBody<T> = { success: true, data };
  if (message) body.message = message;
  return NextResponse.json(body, { status });
}

export function created<T>(data: T, message?: string) {
  return ok(data, message, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

// ─── Error helpers ────────────────────────────────────────────────────────────

export function error(
  message: string,
  status = 500,
  errors?: FieldError[]
): NextResponse {
  const body: ErrorBody = { success: false, data: null, message };
  if (errors?.length) body.errors = errors;
  return NextResponse.json(body, { status });
}

export const badRequest = (message: string, errors?: FieldError[]) =>
  error(message, 400, errors);

export const unauthorized = (message = "Authentication required.") =>
  error(message, 401);

export const forbidden = (message = "Insufficient permissions.") =>
  error(message, 403);

export const notFound = (message = "Resource not found.") =>
  error(message, 404);

export const conflict = (message: string) => error(message, 409);

export const serverError = (message = "An unexpected error occurred.") =>
  error(message, 500);

/**
 * hooks/useApi.ts
 *
 * Authenticated fetch utility for internal API calls.
 *
 * Reads the JWT from localStorage (set by AuthContext on login) and attaches
 * it as the Authorization header. Falls back gracefully if no token is present.
 *
 * Usage:
 *   const api = useApi();
 *   const data = await api.get("/api/enrollments/my");
 *   const result = await api.post("/api/courses", { title: "My Course" });
 */

"use client";

import { useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useApi() {
  const request = useCallback(
    async <T = unknown>(
      path: string,
      options: RequestOptions = {}
    ): Promise<ApiResponse<T>> => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("auth_token")
          : null;

      const headers: HeadersInit = {
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(options.headers as Record<string, string>),
      };

      const res = await fetch(path, {
        ...options,
        headers,
        body:
          options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
      });
      // If it is code 204 (No Content), returns a virtual success object without parsing the JSON
      if (res.status === 204) {
        return { success: true, data: {} as T } as ApiResponse<T>;
      }
      // Completely eliminate errors by reading the text beforehand
      const text = await res.text();
      const json = text ? JSON.parse(text) : { success: true, data: {} as T };
      return json as ApiResponse<T>;
    },
    []
  );

  return {
    get: <T = unknown>(path: string, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "GET" }),

    post: <T = unknown>(path: string, body?: unknown, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "POST", body }),

    patch: <T = unknown>(path: string, body?: unknown, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "PATCH", body }),

    put: <T = unknown>(path: string, body?: unknown, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "PUT", body }),

    del: <T = unknown>(path: string, init?: Omit<RequestOptions, "method" | "body">) =>
      request<T>(path, { ...init, method: "DELETE" }),

    /** Upload FormData (do NOT set Content-Type — browser sets boundary) */
    upload: <T = unknown>(path: string, formData: FormData) => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("auth_token")
          : null;
      return fetch(path, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then((r) => r.json() as Promise<ApiResponse<T>>);
    },
  };
}

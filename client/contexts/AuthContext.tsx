"use client";

/**
 * contexts/AuthContext.tsx
 *
 * Global authentication state for the entire application.
 *
 * Strategy:
 *  - JWT is stored in localStorage (accessible by JS, easy for API calls).
 *  - On mount, the context calls GET /api/auth/me to validate the stored
 *    token and hydrate the user object — this handles hard-refreshes.
 *  - The server also sets an HTTP-only cookie on login for SSR/middleware use.
 *
 * Exposed API:
 *  - user          — SafeUser | null
 *  - isAuthenticated — boolean
 *  - isLoading     — boolean (true while the /me check is in-flight)
 *  - login(email, password) → Promise<void>  (throws on error)
 *  - register(data) → Promise<void>           (throws on error)
 *  - logout() → Promise<void>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { RegisterOutput } from "@/lib/validations/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterOutput) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOKEN_KEY = "lms_auth_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /** Validate stored token on every page load / hard-refresh. */
  const hydrateUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setUser(json.data as AuthUser);
      } else {
        // Token is invalid or expired — clean up.
        clearToken();
      }
    } catch {
      clearToken();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateUser();
  }, [hydrateUser]);

  // ─── login ────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Login failed.");
      }

      setToken(json.data.accessToken);
      setUser(json.data.user as AuthUser);
    },
    []
  );

  // ─── register ─────────────────────────────────────────────────────────────

  const register = useCallback(
    async (data: RegisterOutput) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Registration failed.");
      }

      // Auto-login after successful registration.
      await login(data.email, data.password);
    },
    [login]
  );

  // ─── logout ───────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    try {
      // Clear the HTTP-only cookie on the server side.
      await fetch("/api/auth/me", {
        method: "DELETE",
        headers: authHeaders(),
      });
    } finally {
      clearToken();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  // ─── Memoised value ───────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Internal export for hook ────────────────────────────────────────────────

export { AuthContext };

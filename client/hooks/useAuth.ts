"use client";

/**
 * hooks/useAuth.ts
 *
 * Thin wrapper around AuthContext that throws a helpful error
 * if used outside of <AuthProvider> — catches accidental misuse early.
 */

import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used inside <AuthProvider>. " +
        "Wrap your app (or the relevant subtree) with <AuthProvider>."
    );
  }
  return ctx;
}

"use client";

// Dev-only login bypass so the frontend can be clicked through without a
// running LINE OAuth flow -- see PLAN.md (frontend-first). Gated on
// NODE_ENV rather than a NEXT_PUBLIC_ env var so it's dead-code eliminated
// from production builds automatically (next build always sets
// NODE_ENV=production, see frontend/Dockerfile) instead of relying on
// someone remembering to unset a flag.
//
// Hits the real backend (POST /auth/dev-login, only routed when the
// backend itself is running in development -- see server.New) and stores
// the token exactly like a real login, so every page and every api-*.ts
// call behaves identically to a real logged-in user instead of a
// special-cased mock session.
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import type { Role } from "@/lib/session";

export const devBypassAvailable = process.env.NODE_ENV === "development";

type DevLoginResponse = {
  access_token: string;
  user: { is_registered: boolean };
};

export async function startDevSession(role: Role): Promise<void> {
  const res = await apiFetch("/auth/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Dev login failed (${res.status})`);
  }

  const data = (await res.json()) as DevLoginResponse;
  setAccessToken(data.access_token);
}

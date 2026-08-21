"use client";

// Dev-only login bypass so the frontend can be clicked through without a
// running Go backend or real LINE OAuth — see PLAN.md (frontend-first).
// Gated on NODE_ENV rather than a NEXT_PUBLIC_ env var so it's dead-code
// eliminated from production builds automatically (next build always sets
// NODE_ENV=production, see frontend/Dockerfile) instead of relying on
// someone remembering to unset a flag.
import type { Me, Role } from "@/lib/session";
import { setAccessToken } from "@/lib/auth";

export const devBypassAvailable = process.env.NODE_ENV === "development";

const MOCK_ROLE_KEY = "checkdee_dev_mock_role";
const MOCK_ACCESS_TOKEN = "dev-mock-token";

const devUsers: Record<Role, Me> = {
  employee: {
    id: "user-1",
    role: "employee",
    first_name: "Nira",
    last_name: "Suwan",
    student_gen: "7",
    student_id: "6512345678",
    phone_number: "0812345678",
    display_name: "Nira S.",
    picture_url: null,
    is_registered: true,
  },
  supervisor: {
    id: "user-4",
    role: "supervisor",
    first_name: "Anong",
    last_name: "Wattana",
    student_gen: null,
    student_id: null,
    phone_number: null,
    display_name: "Anong W.",
    picture_url: null,
    is_registered: true,
  },
  admin: {
    id: "user-admin",
    role: "admin",
    first_name: "Admin",
    last_name: "User",
    student_gen: null,
    student_id: null,
    phone_number: null,
    display_name: "Admin User",
    picture_url: null,
    is_registered: true,
  },
  system_owner: {
    id: "user-owner",
    role: "system_owner",
    first_name: "System",
    last_name: "Owner",
    student_gen: null,
    student_id: null,
    phone_number: null,
    display_name: "System Owner",
    picture_url: null,
    is_registered: true,
  },
};

export function startDevSession(role: Role): void {
  sessionStorage.setItem(MOCK_ROLE_KEY, role);
  setAccessToken(MOCK_ACCESS_TOKEN);
}

export function getDevSessionUser(): Me | null {
  if (!devBypassAvailable) return null;
  const role = sessionStorage.getItem(MOCK_ROLE_KEY) as Role | null;
  return role ? devUsers[role] : null;
}

export function isDevSessionActive(): boolean {
  return devBypassAvailable && sessionStorage.getItem(MOCK_ROLE_KEY) !== null;
}

export function clearDevSession(): void {
  sessionStorage.removeItem(MOCK_ROLE_KEY);
}

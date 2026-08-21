"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";

export type Role = "system_owner" | "admin" | "supervisor" | "employee";

export type Me = {
  id: string;
  role: Role;
  first_name: string | null;
  last_name: string | null;
  student_gen: string | null;
  student_id: string | null;
  phone_number: string | null;
  project: string | null;
  email: string | null;
  display_name: string | null;
  picture_url: string | null;
  is_registered: boolean;
};

// Shared by both the employee and admin layout shells: loads /auth/me, and
// redirects to /login or /register the same way the old page-level guards
// each did independently before the shells existed.
export function useSession(): { me: Me | null; loading: boolean } {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    (async () => {
      const res = await apiFetch("/auth/me");
      if (!res.ok) {
        clearAccessToken();
        router.replace("/login");
        return;
      }

      const data = (await res.json()) as Me;
      if (!data.is_registered) {
        router.replace("/register");
        return;
      }

      setMe(data);
      setLoading(false);
    })();
  }, [router]);

  return { me, loading };
}

// Set by the employee/admin layout shells (the only places that call
// useSession) so pages further down the tree can read the already-loaded
// session without re-fetching /auth/me on every tab change.
export const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) {
    throw new Error("useMe() must be used inside a session-guarded layout");
  }
  return me;
}

// Clears the server-side session and local token. Callers navigate to
// /login themselves via useRouter (this isn't a hook, so it can't).
export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
  clearAccessToken();
}

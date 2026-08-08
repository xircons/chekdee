import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string };
  setAccessToken(data.access_token);
  return data.access_token;
}

// apiFetch attaches the access token and transparently retries once via
// the httpOnly refresh cookie on a 401 — see design.md security rules
// (sessions are revoked server-side, never trust client-only state).
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const token = getAccessToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  };

  let res = await attempt();

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      clearAccessToken();
      return res;
    }
    res = await attempt();
  }

  return res;
}

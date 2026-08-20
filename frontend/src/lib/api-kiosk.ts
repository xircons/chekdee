const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type KioskQrToken = {
  token: string;
  expiresAt: string;
  deviceName: string;
};

// GET /kiosk/qr-token is device-token authenticated via a `token` query
// param, not a user JWT — deliberately not going through apiFetch, which
// attaches the logged-in user's bearer token and retries on 401 via the
// user's refresh cookie. Neither applies to a kiosk screen with no user
// session.
export async function getKioskQrToken(deviceToken: string): Promise<KioskQrToken> {
  const res = await fetch(`${API_BASE_URL}/kiosk/qr-token?token=${encodeURIComponent(deviceToken)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  const data = (await res.json()) as { token: string; expires_at: string; device_name: string };
  return { token: data.token, expiresAt: data.expires_at, deviceName: data.device_name };
}

export type KioskRosterStats = {
  totalActive: number;
  checkedIn: number;
  late: number;
  absent: number;
  onLeave: number;
};

// GET /kiosk/roster-stats is device-token authenticated the same way as
// getKioskQrToken above -- aggregate-only counts, no employee names/ids
// (see the backend handler's doc comment for why this is a separate,
// narrower endpoint rather than a loosened /reports/daily-log).
export async function getKioskRosterStats(deviceToken: string): Promise<KioskRosterStats> {
  const res = await fetch(`${API_BASE_URL}/kiosk/roster-stats?token=${encodeURIComponent(deviceToken)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    total_active: number;
    checked_in: number;
    late: number;
    absent: number;
    on_leave: number;
  };
  return {
    totalActive: data.total_active,
    checkedIn: data.checked_in,
    late: data.late,
    absent: data.absent,
    onLeave: data.on_leave,
  };
}

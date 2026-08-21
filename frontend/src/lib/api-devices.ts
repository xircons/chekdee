import { apiFetch } from "@/lib/api";

// Wire-format shape from GET/POST /kiosk/devices and POST .../rotate
// (snake_case, per openapi/openapi.yaml's KioskDevice schema). Deliberately
// not mapped onto MockKioskDevice — the backend has no "location" field and
// only ever returns the raw token once (create/rotate), so the shapes
// genuinely diverge rather than just needing a key rename.
type KioskDeviceResponse = {
  id: string;
  device_id: string;
  name: string;
  masked_token: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
};

type KioskDeviceWithTokenResponse = KioskDeviceResponse & { token: string };

export type KioskDevice = {
  id: string;
  deviceId: string;
  name: string;
  maskedToken: string;
  createdAt: string;
  revokedAt: string | null;
};

function toKioskDevice(r: KioskDeviceResponse): KioskDevice {
  return {
    id: r.id,
    deviceId: r.device_id,
    name: r.name,
    maskedToken: r.masked_token,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  };
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// Latest row per device (active or revoked) — see backend
// KioskDeviceRepository.ListAll.
export async function listKioskDevices(): Promise<KioskDevice[]> {
  const res = await apiFetch("/kiosk/devices");
  const rows = await parseOrThrow<KioskDeviceResponse[]>(res);
  return rows.map(toKioskDevice);
}

// The raw token is only ever returned here and from rotateKioskDevice —
// every later read only gets the masked form back.
export async function createKioskDevice(name: string): Promise<{ device: KioskDevice; token: string }> {
  const res = await apiFetch("/kiosk/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const r = await parseOrThrow<KioskDeviceWithTokenResponse>(res);
  return { device: toKioskDevice(r), token: r.token };
}

export async function rotateKioskDevice(deviceId: string): Promise<{ device: KioskDevice; token: string }> {
  const res = await apiFetch(`/kiosk/devices/${deviceId}/rotate`, { method: "POST" });
  const r = await parseOrThrow<KioskDeviceWithTokenResponse>(res);
  return { device: toKioskDevice(r), token: r.token };
}

export async function revokeKioskDevice(deviceId: string): Promise<void> {
  const res = await apiFetch(`/kiosk/devices/${deviceId}/revoke`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
  }
}

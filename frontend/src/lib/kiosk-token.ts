// Mock stand-in for the real HMAC-signed QR payload (Phase 4: siteId, nonce,
// expiresAt, signed server-side, verified by signature+expiry with no DB
// lookup). There's no backend secret to sign with yet, so this just encodes
// the same shape into a token the confirm page can parse and check the
// expiry of — no real signature, not meant to be secure, only to model the
// rotation/expiry behavior the real thing will have.

export const KIOSK_QR_ROTATE_SECONDS = 15;

export type KioskQrPayload = {
  siteId: string;
  nonce: string;
  expiresAt: number; // epoch ms
};

export function generateKioskQrPayload(siteId: string): KioskQrPayload {
  return {
    siteId,
    nonce: Math.random().toString(36).slice(2, 10),
    expiresAt: Date.now() + KIOSK_QR_ROTATE_SECONDS * 1000,
  };
}

export function encodeKioskQrPayload(payload: KioskQrPayload): string {
  return btoa(JSON.stringify(payload));
}

export function decodeKioskQrPayload(encoded: string): KioskQrPayload | null {
  try {
    const parsed = JSON.parse(atob(encoded));
    if (typeof parsed.siteId === "string" && typeof parsed.nonce === "string" && typeof parsed.expiresAt === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function isKioskQrPayloadExpired(payload: KioskQrPayload, now: number = Date.now()): boolean {
  return now > payload.expiresAt;
}

// 6-digit fallback code shown alongside the QR, for when a device's
// camera/QR scanning fails inside the LINE in-app browser. Derived from the
// same payload so it's tied to the same rotation window, not tracked
// separately.
export function deriveFallbackCode(payload: KioskQrPayload): string {
  const seed = `${payload.siteId}:${payload.nonce}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return String(Math.abs(h) % 1_000_000).padStart(6, "0");
}

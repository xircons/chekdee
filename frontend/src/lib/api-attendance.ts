import { apiFetch } from "@/lib/api";

// Wire-format shape from POST /attendance/check-in and /check-out
// (snake_case, per openapi/openapi.yaml's AttendanceRecord schema).
type AttendanceRecordResponse = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_at: string | null; // "HH:MM:SS", time-of-day only
  check_out_at: string | null;
  status: string;
  auto_closed: boolean;
};

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

// Maps the backend's terse error messages (in English, per its error
// convention) to the Thai copy this app otherwise always shows.
const ERROR_MESSAGES_TH: Record<string, string> = {
  "invalid or expired qr code": "QR หมดอายุแล้ว กรุณาสแกนใหม่อีกครั้ง",
  "qr code already used — scan the current one": "QR นี้ถูกใช้ไปแล้ว กรุณาสแกนรหัสปัจจุบันอีกครั้ง",
  "kiosk device is not active": "อุปกรณ์นี้ถูกเพิกถอนแล้ว",
  "already checked in today": "เช็คอินไปแล้ววันนี้",
  "not checked in today": "ยังไม่ได้เช็คอินวันนี้",
  "already checked out today": "เช็คเอาต์ไปแล้ววันนี้",
};

function toThaiMessage(message: string): string {
  return ERROR_MESSAGES_TH[message] ?? message;
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(toThaiMessage(body?.message ?? `Request failed (${res.status})`));
  }
  return res.json() as Promise<T>;
}

// qrToken is the opaque signed value from the kiosk's QR (GET
// /kiosk/qr-token), passed through the URL the employee's phone opens.
export async function checkIn(qrToken: string): Promise<AttendanceRecordResponse> {
  const res = await apiFetch("/attendance/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qr_token: qrToken, idempotency_key: newIdempotencyKey() }),
  });
  return parseOrThrow<AttendanceRecordResponse>(res);
}

export async function checkOut(): Promise<AttendanceRecordResponse> {
  const res = await apiFetch("/attendance/check-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotency_key: newIdempotencyKey() }),
  });
  return parseOrThrow<AttendanceRecordResponse>(res);
}

// Admin manual correction -- PATCH /attendance-records/:id/status. id is
// the underlying attendance_records id (GET /reports/daily-log's `id`
// field), not the employee id.
export async function correctAttendanceStatus(
  attendanceRecordId: string,
  status: "present" | "late" | "absent",
  reason: string
): Promise<AttendanceRecordResponse> {
  const res = await apiFetch(`/attendance-records/${attendanceRecordId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  });
  return parseOrThrow<AttendanceRecordResponse>(res);
}

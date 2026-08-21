import { apiFetch } from "@/lib/api";

// Wire-format shape from POST /attendance/check-in, /check-out, and
// GET /attendance/me/today (snake_case, per openapi/openapi.yaml's
// AttendanceRecord schema).
export type AttendanceRecordResponse = {
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

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
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

// The caller's own attendance record for today, or null if they haven't
// checked in yet -- used to hydrate the home page's status on load, since
// AttendanceProvider's in-memory state otherwise starts blank on reload.
export async function getTodayAttendance(): Promise<AttendanceRecordResponse | null> {
  const res = await apiFetch("/attendance/me/today");
  return parseOrThrow<AttendanceRecordResponse | null>(res);
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

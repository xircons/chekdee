import { apiFetch } from "@/lib/api";
import type { MockWorkSchedule } from "@/lib/mock-data";

// Wire-format shape from GET /schedules/me and /schedules/{employeeId}
// (snake_case, per openapi/openapi.yaml's WorkSchedule schema) — mapped to
// MockWorkSchedule's camelCase shape so existing components don't change.
type WorkScheduleResponse = {
  id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  effective_from: string;
  effective_to: string | null;
};

// MockWorkSchedule.startTime/endTime are "HH:mm" (no seconds) — trims the
// backend's "HH:MM:SS" to match the existing display format.
function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

function toWorkSchedule(r: WorkScheduleResponse): MockWorkSchedule {
  return {
    id: r.id,
    employeeId: r.employee_id,
    dayOfWeek: r.day_of_week,
    startTime: trimSeconds(r.start_time),
    endTime: trimSeconds(r.end_time),
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
  };
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getMySchedule(): Promise<MockWorkSchedule[]> {
  const res = await apiFetch("/schedules/me");
  const rows = await parseOrThrow<WorkScheduleResponse[]>(res);
  return rows.map(toWorkSchedule);
}

// Admin view of one employee's schedule.
export async function getEmployeeSchedule(employeeId: string): Promise<MockWorkSchedule[]> {
  const res = await apiFetch(`/schedules/${employeeId}`);
  const rows = await parseOrThrow<WorkScheduleResponse[]>(res);
  return rows.map(toWorkSchedule);
}

// Replaces an employee's whole schedule — the admin single-employee editor
// and CSV import both reduce to this one call (see backend PR 5 notes).
export async function replaceEmployeeSchedule(
  employeeId: string,
  rows: { day_of_week: number; start_time: string; end_time: string; effective_from: string; effective_to?: string | null }[]
): Promise<MockWorkSchedule[]> {
  const res = await apiFetch(`/schedules/${employeeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  const result = await parseOrThrow<WorkScheduleResponse[]>(res);
  return result.map(toWorkSchedule);
}

import { apiFetch } from "@/lib/api";

// Wire-format shapes from GET /reports/monthly and POST/GET
// /reports/export... (snake_case, per openapi/openapi.yaml).
type MonthlyReportRowResponse = {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  work_days: number;
  late_count: number;
  late_minutes: number;
  absent_count: number;
  leave_days: number;
  worked_hours: number;
};

export type MonthlyReportRow = {
  employeeId: string;
  firstName: string | null;
  lastName: string | null;
  workDays: number;
  lateCount: number;
  lateMinutes: number;
  absentCount: number;
  leaveDays: number;
  workedHours: number;
};

function toMonthlyReportRow(r: MonthlyReportRowResponse): MonthlyReportRow {
  return {
    employeeId: r.employee_id,
    firstName: r.first_name,
    lastName: r.last_name,
    workDays: r.work_days,
    lateCount: r.late_count,
    lateMinutes: r.late_minutes,
    absentCount: r.absent_count,
    leaveDays: r.leave_days,
    workedHours: r.worked_hours,
  };
}

// Wire-format shape from GET /reports/daily-log (snake_case, per
// openapi/openapi.yaml's DailyLogRow schema). status is the backend's
// English enum -- present/late/absent (pending is a DB-default sentinel
// never actually returned: CheckIn always computes one of the other three
// immediately) -- distinct from the frontend's Thai-literal AttendanceStatus
// ("present" | "สาย" | "ขาด"), so callers map it themselves rather than this
// module assuming which convention they want.
type DailyLogRowResponse = {
  date: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  status: "pending" | "present" | "late" | "absent";
  check_in_at: string | null;
  check_out_at: string | null;
  auto_closed: boolean;
};

export type DailyLogRow = {
  date: string;
  employeeId: string;
  firstName: string | null;
  lastName: string | null;
  status: "pending" | "present" | "late" | "absent";
  checkInAt: string | null;
  checkOutAt: string | null;
  autoClosed: boolean;
};

function toDailyLogRow(r: DailyLogRowResponse): DailyLogRow {
  return {
    date: r.date,
    employeeId: r.employee_id,
    firstName: r.first_name,
    lastName: r.last_name,
    status: r.status,
    checkInAt: r.check_in_at,
    checkOutAt: r.check_out_at,
    autoClosed: r.auto_closed,
  };
}

type ReportExportResponse = {
  id: string;
  month: string;
  status: "processing" | "ready" | "failed";
  error: string | null;
};

export type ReportExport = {
  id: string;
  month: string;
  status: "processing" | "ready" | "failed";
  error: string | null;
};

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// month is "YYYY-MM".
export async function getMonthlyReport(month: string): Promise<MonthlyReportRow[]> {
  const res = await apiFetch(`/reports/monthly?month=${month}`);
  const rows = await parseOrThrow<MonthlyReportRowResponse[]>(res);
  return rows.map(toMonthlyReportRow);
}

// month is "YYYY-MM"; employeeId narrows to one employee's rows (used by
// the admin/employees detail-dialog heatmap), omitted for the org-wide log
// (used by the admin dashboard, filtered to today client-side).
export async function getDailyLog(month: string, employeeId?: string): Promise<DailyLogRow[]> {
  const params = new URLSearchParams({ month });
  if (employeeId) params.set("employee_id", employeeId);
  const res = await apiFetch(`/reports/daily-log?${params.toString()}`);
  const rows = await parseOrThrow<DailyLogRowResponse[]>(res);
  return rows.map(toDailyLogRow);
}

// Enqueues an async Excel export (river job, built server-side by
// internal/reportxlsx) — poll getReportExport(id) until status leaves
// "processing".
export async function requestReportExport(month: string): Promise<ReportExport> {
  const res = await apiFetch("/reports/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month }),
  });
  return parseOrThrow<ReportExportResponse>(res);
}

export async function getReportExport(id: string): Promise<ReportExport> {
  const res = await apiFetch(`/reports/export/${id}`);
  return parseOrThrow<ReportExportResponse>(res);
}

export async function downloadReportExport(id: string): Promise<Blob> {
  const res = await apiFetch(`/reports/export/${id}/download`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return res.blob();
}

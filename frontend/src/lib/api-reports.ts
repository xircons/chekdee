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

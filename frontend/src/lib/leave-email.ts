import { formatThaiDateRange } from "@/lib/utils";

export type LeaveRequestEmailInput = {
  employeeName: string;
  position: string;
  team: string;
  startDate: string; // ISO date, e.g. "2026-08-20"
  endDate: string;
  reason: string;
};

export type LeaveRequestEmail = {
  subject: string;
  body: string;
};

// Shared by the /leave inline preview and (eventually) the real outbound
// email in Phase 4 — keep both in sync by always going through this.
export function buildLeaveRequestEmail(input: LeaveRequestEmailInput): LeaveRequestEmail {
  const { employeeName, position, team, startDate, endDate, reason } = input;

  const dateRange = startDate && endDate ? formatThaiDateRange(startDate, endDate) : "-";

  const subject = `คำขอลา - ${employeeName} - ${dateRange}`;

  const body = [
    "เรียน หัวหน้างาน",
    "",
    `กระผม/ดิฉัน ${employeeName} ${position} แผนก ${team} ขอลาในวันที่ ${dateRange} เนื่องจาก${reason.trim() || "-"}`,
    "",
    "จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ",
    "",
    "ขอแสดงความนับถือ",
    employeeName,
  ].join("\n");

  return { subject, body };
}

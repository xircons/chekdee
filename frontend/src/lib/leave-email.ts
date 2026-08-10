import { formatThaiDate, THAI_MONTH_LABELS } from "@/lib/utils";

export type LeaveRequestEmailInput = {
  employeeName: string;
  position: string;
  team: string;
  startDate: string; // ISO date, e.g. "2026-08-20"
  endDate: string;
  reason: string;
};

function parseIsoDateLocal(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

// "20-21 สิงหาคม 2569" when the range stays within one month, otherwise
// falls back to the full "20 สิงหาคม 2569 ถึง 3 กันยายน 2569" form.
function formatDateRangeTh(startIso: string, endIso: string): string {
  const start = parseIsoDateLocal(startIso);
  if (startIso === endIso) return formatThaiDate(start);

  const end = parseIsoDateLocal(endIso);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${THAI_MONTH_LABELS[start.getMonth()]} ${start.getFullYear() + 543}`;
  }
  return `${formatThaiDate(start)} ถึง ${formatThaiDate(end)}`;
}

// Shared by the /leave inline preview and (eventually) the real outbound
// email in Phase 4 — keep both in sync by always going through this.
export function buildLeaveRequestEmail(input: LeaveRequestEmailInput): string {
  const { employeeName, position, team, startDate, endDate, reason } = input;

  const dateRange = startDate && endDate ? formatDateRangeTh(startDate, endDate) : "-";

  return [
    "เรียน หัวหน้างาน",
    "",
    `กระผม/ดิฉัน ${employeeName} ${position} แผนก ${team} ขอลาในวันที่ ${dateRange} เนื่องจาก${reason.trim() || "-"}`,
    "",
    "จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ",
    "",
    "ขอแสดงความนับถือ",
    employeeName,
  ].join("\n");
}

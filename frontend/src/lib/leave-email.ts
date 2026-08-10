import { formatThaiDateRange, formatThaiDateWithDay, parseIsoDateLocal } from "@/lib/utils";

export type LeaveRequestEmailInput = {
  employeeName: string;
  yearOfStudy: string;
  studentId: string;
  phoneNumber: string;
  leaveType: string;
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
  const { employeeName, yearOfStudy, studentId, phoneNumber, leaveType, startDate, endDate, reason } =
    input;

  // Single day reads naturally with the day name ("วันอังคารที่ 11 สิงหาคม
  // 2569"); a range with two day names gets long fast, so ranges fall back
  // to the compact "11-12 สิงหาคม 2569" form instead.
  const dateWithDay =
    startDate && endDate
      ? startDate === endDate
        ? formatThaiDateWithDay(parseIsoDateLocal(startDate))
        : formatThaiDateRange(startDate, endDate)
      : "วันที่";
  const studentLine = `นักศึกษาชั้นปีที่ ${yearOfStudy} รหัสนักศึกษา ${studentId}`;

  const subject = `ขออนุญาตลางาน (${dateWithDay}) - ${employeeName}`;

  const body = [
    "เรียน อาจารย์ และผู้ที่เกี่ยวข้อง",
    "",
    `ผม ${employeeName} ${studentLine} ขออนุญาตลา ${leaveType.trim() || "-"} ในวันที่ ${dateWithDay} ตลอดทั้งวัน เนื่องจาก${reason.trim() || "-"}`,
    "",
    `ในช่วงเวลาดังกล่าว หากมีงานหรือภารกิจที่จำเป็นต้องดำเนินการ สามารถติดต่อผมได้ที่ ${phoneNumber} และผมจะดำเนินการในส่วนที่เกี่ยวข้องให้เรียบร้อยตามความเหมาะสม`,
    "",
    "จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต",
    "",
    "ขอแสดงความนับถือ",
    employeeName,
    studentLine,
  ].join("\n");

  return { subject, body };
}

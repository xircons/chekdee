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
  attachmentCount?: number;
};

export type LeaveRequestEmail = {
  subject: string;
  body: string;
};

// Static formal-letter template shown in the live "ตัวอย่างอีเมล" preview —
// deliberately not bound to any form/profile data (see buildLeaveRequestEmail
// below for why), so it's just a fixed reference string.
const STATIC_BODY_TEMPLATE = [
  "เรียน อาจารย์ และผู้ที่เกี่ยวข้อง",
  "",
  "ผม [ชื่อ-นามสกุล] นักศึกษาชั้นปีที่ [ชั้นปี] รหัสนักศึกษา [รหัสนักศึกษา] ขออนุญาตลา [ประเภทการลา] ในวันที่ [วัน/วันที่] [ช่วงเวลา/ตลอดทั้งวัน] เนื่องจาก [ระบุเหตุผลหรือความจำเป็นในการลาโดยสังเขป]",
  "",
  "ในช่วงเวลาดังกล่าว หากมีงานหรือภารกิจที่จำเป็นต้องดำเนินการ สามารถติดต่อผมได้ที่ [เบอร์โทรศัพท์] และผมจะดำเนินการในส่วนที่เกี่ยวข้องให้เรียบร้อยตามความเหมาะสม",
  "",
  "จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต",
  "",
  "ขอแสดงความนับถือ",
  "[ชื่อ-นามสกุล]",
  "นักศึกษาชั้นปีที่ [ชั้นปี]",
  "รหัสนักศึกษา [รหัสนักศึกษา]"
].join("\n");

// Shared by the /leave inline preview and (eventually) the real outbound
// email in Phase 4 — keep both in sync by always going through this.
//
// User-flow: the subject still auto-fills from real data (name + the
// selected start/end date) so it's always accurate at a glance. The body is
// a fixed template, not bound to form/profile data — the employee fills in
// the bracketed fields themselves when actually sending, so the preview
// never shows stale or half-typed values.
export function buildLeaveRequestEmail(input: LeaveRequestEmailInput): LeaveRequestEmail {
  const { employeeName, startDate, endDate } = input;

  // Single day reads naturally with the day name ("วันอังคารที่ 11 สิงหาคม
  // 2569"); a range with two day names gets long fast, so ranges fall back
  // to the compact "11-12 สิงหาคม 2569" form instead.
  const dateWithDay =
    startDate && endDate
      ? startDate === endDate
        ? formatThaiDateWithDay(parseIsoDateLocal(startDate))
        : formatThaiDateRange(startDate, endDate)
      : "วันที่";

  const subject = `ขออนุญาตลางาน (${dateWithDay}) - ${employeeName}`;

  return { subject, body: STATIC_BODY_TEMPLATE };
}

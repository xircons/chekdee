// Stand-in for the Go backend while it's not wired up yet — see PLAN.md
// Phase 1. Shapes mirror the tables in backend/db/migrations exactly
// (users, work_schedules, holidays, attendance_records, leave_requests)
// so swapping these fixtures for real API calls in Phase 4 is a
// find-and-replace of the accessor functions below, not a data model
// change.

export type Role = "system_owner" | "admin" | "supervisor" | "employee";
export type UserStatus = "active" | "inactive";

export const ROLE_LABEL_TH: Record<Role, string> = {
  employee: "พนักงาน",
  supervisor: "หัวหน้างาน",
  admin: "ผู้ดูแลระบบ",
  system_owner: "เจ้าของระบบ",
};

export type MockEmployee = {
  id: string;
  role: Role;
  status: UserStatus;
  teamId: string;
  firstName: string;
  lastName: string;
  // The student generation ordinal (e.g. "7"), not an admission year — see
  // getYearOfStudy below for the year-of-study figure derived from it.
  studentGen: string | null;
  displayName: string;
  pictureUrl: string | null;
  offboardedAt: string | null;
  offboardedBy: string | null;
  offboardedReason: string | null;
  // Optional: not yet managed by the admin employee form, only shown on
  // the employee's own profile page.
  nickname?: string | null;
  studentId?: string | null;
  phoneNumber?: string | null;
};

export type MockWorkSchedule = {
  id: string;
  employeeId: string;
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // "HH:mm"
  endTime: string;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
};

export type MockHoliday = {
  id: string;
  date: string; // ISO date
  name: string;
  localName: string | null;
  source: "nager_date" | "manual";
};

export type AttendanceStatus = "present" | "สาย" | "ขาด";

export type MockAttendanceRecord = {
  id: string;
  employeeId: string;
  workDate: string; // ISO date
  checkInAt: string | null;
  checkOutAt: string | null;
  status: AttendanceStatus | null;
  autoClosed: boolean;
};

// Audit trail for admin corrections to a computed status (or an auto-closed
// checkout) — who changed it, when, and the old/new value. Session-only for
// now, like every other mutable list here; a real audit_log table is Phase 4.
export type MockAttendanceCorrection = {
  id: string;
  employeeId: string;
  date: string; // ISO date
  previousStatus: AttendanceStatus | null;
  newStatus: AttendanceStatus;
  reason: string | null;
  correctedBy: string;
  correctedAt: string;
};

// Seed fixture, not session state — the admin dashboard's own correction
// flow keeps its corrections in local component state (lost on navigation,
// same as every other mutable list there) rather than writing back here.
// This one fixture row exists so the reports daily log below has a
// realistic correction reason to surface in its notes column.
export const mockAttendanceCorrections: MockAttendanceCorrection[] = [
  {
    id: "corr-1",
    employeeId: "user-1",
    date: "2026-08-08",
    previousStatus: null,
    newStatus: "present",
    reason: "พนักงานลืมเช็คเอาท์ ยืนยันกับหัวหน้างานแล้วว่ามาทำงานตามปกติ",
    correctedBy: "user-4",
    correctedAt: "2026-08-09T02:00:00Z",
  },
];

export type LeaveStatus = "pending" | "approved" | "rejected";

export type MockLeaveRequest = {
  id: string;
  employeeId: string;
  leaveType: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  submittedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
};

export const mockTeam = { id: "team-1", name: "CAMT Front Desk" };

// [firstName, lastName] pairs appended to the 5 fixture employees below to
// reach a realistic team size for testing the admin dashboard's roster
// list and the employees table's pagination. Change the length of this
// list to grow/shrink the mock team.
const EXTRA_ROSTER_NAMES: [string, string][] = [
  ["Chatchai", "Boonmee"],
  ["Suda", "Panyawong"],
  ["Anan", "Ratanakul"],
  ["Wipada", "Srisawat"],
  ["Somchai", "Thongdee"],
  ["Napaporn", "Chaiyasit"],
  ["Kittipong", "Uraiwan"],
  ["Ratree", "Phromma"],
  ["Decha", "Wongsa"],
  ["Malee", "Sukjai"],
  ["Prasert", "Kamnoon"],
  ["Siriporn", "Tangsiri"],
  ["Boonrod", "Yodkhun"],
  ["Kanya", "Intharak"],
  ["Anucha", "Sombat"],
  ["Ladda", "Wanchai"],
  ["Sombat", "Chaisiri"],
  ["Piyada", "Rungrueang"],
  ["Thawatchai", "Meesuk"],
  ["Orawan", "Phetsuwan"],
];

export const mockEmployees: MockEmployee[] = [
  {
    id: "user-1",
    role: "employee",
    status: "active",
    teamId: mockTeam.id,
    firstName: "Nira",
    lastName: "Suwan",
    studentGen: "7",
    displayName: "Nira S.",
    pictureUrl: null,
    offboardedAt: null,
    offboardedBy: null,
    offboardedReason: null,
    nickname: "Nira",
    studentId: "672110160",
    phoneNumber: "081-234-5678",
  },
  {
    id: "user-2",
    role: "employee",
    status: "active",
    teamId: mockTeam.id,
    firstName: "Ploy",
    lastName: "Charoen",
    studentGen: "6",
    displayName: "Ploy C.",
    pictureUrl: null,
    offboardedAt: null,
    offboardedBy: null,
    offboardedReason: null,
    nickname: "Ploy",
    studentId: "652110145",
    phoneNumber: "082-345-6789",
  },
  {
    id: "user-3",
    role: "employee",
    status: "active",
    teamId: mockTeam.id,
    firstName: "Kritsada",
    lastName: "Boon",
    studentGen: "7",
    displayName: "Kritsada B.",
    pictureUrl: null,
    offboardedAt: null,
    offboardedBy: null,
    offboardedReason: null,
    nickname: "Kritsada",
    studentId: "672110233",
    phoneNumber: "083-456-7890",
  },
  {
    id: "user-4",
    role: "supervisor",
    status: "active",
    teamId: mockTeam.id,
    firstName: "Anong",
    lastName: "Wattana",
    studentGen: null,
    displayName: "Anong W.",
    pictureUrl: null,
    offboardedAt: null,
    offboardedBy: null,
    offboardedReason: null,
    nickname: "Anong",
    studentId: null,
    phoneNumber: "084-567-8901",
  },
  {
    id: "user-5",
    role: "employee",
    status: "inactive",
    teamId: mockTeam.id,
    firstName: "Somsak",
    lastName: "Intra",
    studentGen: "5",
    displayName: "Somsak I.",
    pictureUrl: null,
    offboardedAt: "2026-06-30T00:00:00Z",
    offboardedBy: "user-4",
    offboardedReason: "Graduated",
    nickname: "Somsak",
    studentId: "642110198",
    phoneNumber: "085-678-9012",
  },
  // Extra roster for testing the admin dashboard's "today's roster" list at
  // a realistic team size — adjust EXTRA_ROSTER_NAMES.length to grow/shrink
  // the mock team without touching anything else.
  ...EXTRA_ROSTER_NAMES.map(
    ([firstName, lastName], i): MockEmployee => ({
      id: `user-${6 + i}`,
      role: "employee",
      status: "active",
      teamId: mockTeam.id,
      firstName,
      lastName,
      studentGen: String(4 + (i % 4)),
      displayName: `${firstName} ${lastName[0]}.`,
      pictureUrl: null,
      offboardedAt: null,
      offboardedBy: null,
      offboardedReason: null,
      nickname: firstName,
      studentId: String(660000000 + i * 137),
      phoneNumber: null,
    })
  ),
];

// Rough shift-start spread so a Monday-Friday roster sorts into a
// realistic staggered list rather than everyone at the same time.
const SHIFT_START_TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00"];

export const mockWorkSchedules: MockWorkSchedule[] = mockEmployees
  .filter((e) => e.status === "active" && e.offboardedAt === null)
  .flatMap((employee, employeeIndex) =>
    [1, 2, 3, 4, 5].map((day) => {
      const startTime = SHIFT_START_TIMES[employeeIndex % SHIFT_START_TIMES.length];
      const [h, m] = startTime.split(":").map(Number);
      const endTime = `${String((h + 8) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      return {
        id: `sched-${employee.id}-${day}`,
        employeeId: employee.id,
        dayOfWeek: day,
        startTime,
        endTime,
        effectiveFrom: "2026-06-01",
        effectiveTo: null,
      };
    })
  );

export const mockHolidays: MockHoliday[] = [
  { id: "hol-1", date: "2026-08-12", name: "Mother's Day", localName: "วันแม่แห่งชาติ", source: "nager_date" },
  { id: "hol-2", date: "2026-10-13", name: "King Bhumibol Memorial Day", localName: "วันคล้ายวันสวรรคต", source: "nager_date" },
  { id: "hol-3", date: "2026-12-05", name: "King's Birthday", localName: "วันพ่อแห่งชาติ", source: "nager_date" },
  { id: "hol-4", date: "2026-09-01", name: "CAMT Foundation Day", localName: "วันคล้ายวันก่อตั้ง CAMT", source: "manual" },
];

export const mockAttendanceRecords: MockAttendanceRecord[] = [
  { id: "att-1", employeeId: "user-1", workDate: "2026-08-04", checkInAt: "2026-08-04T09:02:00Z", checkOutAt: "2026-08-04T17:05:00Z", status: "present", autoClosed: false },
  { id: "att-2", employeeId: "user-1", workDate: "2026-08-05", checkInAt: "2026-08-05T09:18:00Z", checkOutAt: "2026-08-05T17:00:00Z", status: "สาย", autoClosed: false },
  { id: "att-3", employeeId: "user-1", workDate: "2026-08-06", checkInAt: "2026-08-06T08:58:00Z", checkOutAt: "2026-08-06T17:02:00Z", status: "present", autoClosed: false },
  { id: "att-4", employeeId: "user-1", workDate: "2026-08-07", checkInAt: null, checkOutAt: null, status: "ขาด", autoClosed: false },
  { id: "att-5", employeeId: "user-1", workDate: "2026-08-08", checkInAt: "2026-08-08T09:00:00Z", checkOutAt: null, status: null, autoClosed: true },
  { id: "att-6", employeeId: "user-2", workDate: "2026-08-08", checkInAt: "2026-08-08T09:05:00Z", checkOutAt: "2026-08-08T17:00:00Z", status: "present", autoClosed: false },
  { id: "att-7", employeeId: "user-3", workDate: "2026-08-08", checkInAt: null, checkOutAt: null, status: "ขาด", autoClosed: false },
];

export const mockLeaveRequests: MockLeaveRequest[] = [
  { id: "leave-1", employeeId: "user-1", leaveType: "กิจส่วนตัว", startDate: "2026-08-20", endDate: "2026-08-21", reason: "Family event", status: "pending", submittedAt: "2026-08-10T02:30:00Z", decidedBy: null, decidedAt: null },
  { id: "leave-2", employeeId: "user-1", leaveType: "ป่วย", startDate: "2026-07-14", endDate: "2026-07-14", reason: "Doctor's appointment", status: "approved", submittedAt: "2026-07-09T04:00:00Z", decidedBy: "user-4", decidedAt: "2026-07-10T03:00:00Z" },
  { id: "leave-3", employeeId: "user-2", leaveType: "กิจส่วนตัว", startDate: "2026-08-15", endDate: "2026-08-16", reason: "Personal", status: "pending", submittedAt: "2026-08-09T07:15:00Z", decidedBy: null, decidedAt: null },
  { id: "leave-4", employeeId: "user-3", leaveType: "ป่วย", startDate: "2026-06-02", endDate: "2026-06-03", reason: "Sick", status: "rejected", submittedAt: "2026-05-30T06:00:00Z", decidedBy: "user-4", decidedAt: "2026-06-01T03:00:00Z" },
];

// "ชั้นปี" isn't stored directly — derive it from studentGen (the
// generation ordinal, e.g. "7"), converting back to an admission year
// first (gen 1 started 2020, matching the profile page's Gen ordinal).
export function getYearOfStudy(studentGen: string | null): string {
  const gen = Number(studentGen);
  if (!studentGen || Number.isNaN(gen)) return "-";
  const admissionYear = gen + 2019;
  return String(Math.max(1, new Date().getFullYear() - admissionYear + 1));
}

// Placeholder policy — the real annual entitlement lives in the backend
// once leave accrual is implemented (Phase 4).
export const ANNUAL_LEAVE_DAYS = 10;

// Placeholder org-wide metric for the admin dashboard's on-time ring stat.
// The fixture attendance records above are too sparse to aggregate a
// believable month-to-date figure from — this will come from a real
// summary endpoint once attendance_records has full-month data (Phase 4).
export const MOCK_MONTHLY_ON_TIME = { percent: 94, totalCheckIns: 120 };

export function getWorkScheduleForEmployee(employeeId: string): MockWorkSchedule[] {
  return mockWorkSchedules
    .filter((s) => s.employeeId === employeeId)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

export function getUpcomingHolidays(fromDate: string): MockHoliday[] {
  return mockHolidays.filter((h) => h.date >= fromDate).sort((a, b) => a.date.localeCompare(b.date));
}

export function getAttendanceForEmployee(employeeId: string): MockAttendanceRecord[] {
  return mockAttendanceRecords.filter((r) => r.employeeId === employeeId);
}

// Org-wide accessors — used by the admin/HR views (Phase 3), as opposed
// to the single-employee accessors above (Phase 2).

export function getActiveEmployees(): MockEmployee[] {
  return mockEmployees.filter((e) => e.status === "active" && e.offboardedAt === null);
}

export function getAttendanceForDate(date: string): MockAttendanceRecord[] {
  return mockAttendanceRecords.filter((r) => r.workDate === date);
}

// สาย/ขาด rule: any lateness at all is สาย (no grace period), more than 60
// minutes late is ขาด — whether that's how late an actual check-in was, or
// how long it's been with no check-in yet at all. The second case matters
// for a live dashboard: it needs to flag a no-show as it's happening, not
// only once the day is over, so "still hasn't checked in and it's been over
// an hour" reads as ขาด already (subject to admin correction), while
// "hasn't checked in yet but we're still inside the hour" reads as
// unresolved (null) rather than guessing early.
export function computeAttendanceStatus(
  checkInAt: Date | null,
  scheduledStart: Date,
  now: Date
): AttendanceStatus | null {
  if (checkInAt) {
    const lateMinutes = (checkInAt.getTime() - scheduledStart.getTime()) / 60_000;
    if (lateMinutes <= 0) return "present";
    return lateMinutes <= 60 ? "สาย" : "ขาด";
  }
  if (now < scheduledStart) return null;
  const overdueMinutes = (now.getTime() - scheduledStart.getTime()) / 60_000;
  return overdueMinutes > 60 ? "ขาด" : null;
}

// Deterministic hash so the same employee gets the same simulated check-in
// behavior all day (stable across re-renders/ticks) but a different mix on
// different days — there's no real "who's checked in right now" data source
// yet (Phase 4), so this stands in for one. Shared by the admin dashboard
// and the kiosk TV view so both read the same simulated "today" instead of
// each rolling their own.
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type SimulatedRosterEntry = {
  employee: MockEmployee;
  scheduledStart: Date;
  checkInAt: Date | null;
  status: AttendanceStatus | null;
};

export function getSimulatedRoster(
  employees: MockEmployee[],
  schedules: MockWorkSchedule[],
  now: Date
): SimulatedRosterEntry[] {
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayDow = now.getDay();

  return employees.flatMap((employee) => {
    const schedule = schedules.find((s) => s.employeeId === employee.id && s.dayOfWeek === todayDow);
    if (!schedule) return [];

    const [h, m] = schedule.startTime.split(":").map(Number);
    const scheduledStart = new Date(now);
    scheduledStart.setHours(h, m, 0, 0);

    // ~65% simulated attendance; offset spans -20 to +69 minutes so the
    // demo naturally produces a mix of present/สาย/ขาด instead of everyone
    // landing in the same bucket.
    const roll = hashSeed(employee.id + todayIso) % 100;
    const offsetMinutes = (hashSeed(employee.id + todayIso + "offset") % 90) - 20;
    const simulatedCheckInAt = new Date(scheduledStart.getTime() + offsetMinutes * 60_000);
    const checkedIn = roll < 65 && simulatedCheckInAt <= now;
    const checkInAt = checkedIn ? simulatedCheckInAt : null;

    return [{ employee, scheduledStart, checkInAt, status: computeAttendanceStatus(checkInAt, scheduledStart, now) }];
  });
}

export function getPendingLeaveRequests(): MockLeaveRequest[] {
  return mockLeaveRequests.filter((r) => r.status === "pending");
}

export function getEmployeesOnLeave(date: string): MockLeaveRequest[] {
  return mockLeaveRequests.filter(
    (r) => r.status === "approved" && r.startDate <= date && date <= r.endDate
  );
}

export function getLeaveRequestsForEmployee(employeeId: string): MockLeaveRequest[] {
  return mockLeaveRequests
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function inclusiveDayCount(startDate: string, endDate: string): number {
  const ms = new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

// Same inclusive count, but clipped to a "YYYY-MM" month so a leave request
// spanning a month boundary only contributes the days that actually fall
// inside the month being reported on.
function overlappingDaysInMonth(startDate: string, endDate: string, yearMonth: string): number {
  const [year, month] = yearMonth.split("-").map(Number);
  const monthStart = `${yearMonth}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const clippedStart = startDate > monthStart ? startDate : monthStart;
  const clippedEnd = endDate < monthEnd ? endDate : monthEnd;
  if (clippedStart > clippedEnd) return 0;
  return inclusiveDayCount(clippedStart, clippedEnd);
}

export function getLeaveBalance(employeeId: string, year: number): number {
  const usedDays = mockLeaveRequests
    .filter(
      (r) =>
        r.employeeId === employeeId &&
        r.status === "approved" &&
        new Date(r.startDate).getUTCFullYear() === year
    )
    .reduce((sum, r) => sum + inclusiveDayCount(r.startDate, r.endDate), 0);
  return ANNUAL_LEAVE_DAYS - usedDays;
}

// The work schedule covering a given calendar date for an employee, if any
// — used to find the scheduled start time (for lateness) and shift length
// (for the no-overtime hours cap) below.
function getScheduledShift(employeeId: string, workDate: string): MockWorkSchedule | null {
  const dayOfWeek = new Date(`${workDate}T00:00:00Z`).getUTCDay();
  return (
    mockWorkSchedules.find(
      (s) =>
        s.employeeId === employeeId &&
        s.dayOfWeek === dayOfWeek &&
        s.effectiveFrom <= workDate &&
        (s.effectiveTo === null || workDate <= s.effectiveTo)
    ) ?? null
  );
}

function shiftHours(schedule: MockWorkSchedule): number {
  const [startH, startM] = schedule.startTime.split(":").map(Number);
  const [endH, endM] = schedule.endTime.split(":").map(Number);
  return (endH * 60 + endM - (startH * 60 + startM)) / 60;
}

export type MonthlyAttendanceStats = {
  hours: number;
  lateCount: number;
  lateMinutes: number;
  absentCount: number;
};

// yearMonth like "2026-08".
export function getMonthlyAttendanceStats(employeeId: string, yearMonth: string): MonthlyAttendanceStats {
  const records = getAttendanceForEmployee(employeeId).filter((r) => r.workDate.startsWith(yearMonth));

  const hours = records.reduce((sum, r) => {
    if (!r.checkInAt || !r.checkOutAt) return sum;
    return sum + (new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()) / 3_600_000;
  }, 0);

  const lateMinutes = records.reduce((sum, r) => {
    if (r.status !== "สาย" || !r.checkInAt) return sum;
    const schedule = getScheduledShift(r.employeeId, r.workDate);
    if (!schedule) return sum;
    const scheduledStart = new Date(`${r.workDate}T${schedule.startTime}:00Z`);
    return sum + Math.max(0, (new Date(r.checkInAt).getTime() - scheduledStart.getTime()) / 60_000);
  }, 0);

  return {
    hours: Math.round(hours * 10) / 10,
    lateCount: records.filter((r) => r.status === "สาย").length,
    lateMinutes: Math.round(lateMinutes),
    absentCount: records.filter((r) => r.status === "ขาด").length,
  };
}

// Everything the monthly Excel export's "สรุป" sheet needs for one
// employee row. Reuses getMonthlyAttendanceStats for late/absence figures
// so both this and the employee detail dialog agree on those counts; hours
// here differ from that stat (which is raw actual-hours) because this one
// applies the same min(actual, scheduled) no-overtime cap the rest of the
// codebase assumes for worked-hours figures.
export type MonthlyReportRow = {
  employee: MockEmployee;
  workDays: number;
  lateCount: number;
  lateMinutes: number;
  absentCount: number;
  leaveDays: number;
  workedHours: number;
};

export function getMonthlyReportRow(employeeId: string, yearMonth: string): MonthlyReportRow {
  const employee = mockEmployees.find((e) => e.id === employeeId);
  if (!employee) throw new Error(`Unknown employeeId: ${employeeId}`);

  const records = getAttendanceForEmployee(employeeId).filter((r) => r.workDate.startsWith(yearMonth));
  const stats = getMonthlyAttendanceStats(employeeId, yearMonth);

  const workedHours = records.reduce((sum, r) => {
    if (!r.checkInAt || !r.checkOutAt) return sum;
    const actualHours = (new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()) / 3_600_000;
    const schedule = getScheduledShift(r.employeeId, r.workDate);
    return sum + (schedule ? Math.min(actualHours, shiftHours(schedule)) : actualHours);
  }, 0);

  const leaveDays = mockLeaveRequests
    .filter((r) => r.employeeId === employeeId && r.status === "approved")
    .reduce((sum, r) => sum + overlappingDaysInMonth(r.startDate, r.endDate, yearMonth), 0);

  return {
    employee,
    workDays: records.filter((r) => r.status === "present" || r.status === "สาย").length,
    lateCount: stats.lateCount,
    lateMinutes: stats.lateMinutes,
    absentCount: stats.absentCount,
    leaveDays,
    workedHours: Math.round(workedHours * 10) / 10,
  };
}

export function getMonthlyReportRows(yearMonth: string): MonthlyReportRow[] {
  return getActiveEmployees().map((employee) => getMonthlyReportRow(employee.id, yearMonth));
}

// One row per attendance record in the month, long-format — the export's
// "รายละเอียดรายวัน" sheet, kept for audit/dispute reference. notes combines
// the auto-close flag and any matching correction reason so both surface in
// the same cell instead of needing two columns for what's really one story.
export type DailyLogRow = {
  date: string;
  employeeName: string;
  status: AttendanceStatus | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  notes: string;
};

function toDailyLogRow(r: MockAttendanceRecord): DailyLogRow {
  const employee = mockEmployees.find((e) => e.id === r.employeeId);
  const correction = mockAttendanceCorrections.find(
    (c) => c.employeeId === r.employeeId && c.date === r.workDate
  );
  const notes = [
    r.autoClosed ? "ปิดงานอัตโนมัติ (ไม่ได้เช็คเอาท์)" : null,
    correction?.reason ?? null,
  ]
    .filter((n): n is string => n !== null)
    .join(" / ");

  return {
    date: r.workDate,
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : r.employeeId,
    status: r.status,
    checkInAt: r.checkInAt,
    checkOutAt: r.checkOutAt,
    notes,
  };
}

export function getDailyLogForMonth(yearMonth: string): DailyLogRow[] {
  return mockAttendanceRecords
    .filter((r) => r.workDate.startsWith(yearMonth))
    .map(toDailyLogRow)
    .sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
}

// Same as getDailyLogForMonth but scoped to one employee — the export's
// per-employee sheets need each person's own audit log, not the mixed
// company-wide list.
export function getDailyLogForEmployeeMonth(employeeId: string, yearMonth: string): DailyLogRow[] {
  return mockAttendanceRecords
    .filter((r) => r.employeeId === employeeId && r.workDate.startsWith(yearMonth))
    .map(toDailyLogRow)
    .sort((a, b) => a.date.localeCompare(b.date));
}

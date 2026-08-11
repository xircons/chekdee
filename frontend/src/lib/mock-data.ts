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
// list. Change the length of this list to grow/shrink the mock team.
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
];

export const mockEmployees: MockEmployee[] = [
  {
    id: "user-1",
    role: "employee",
    status: "active",
    teamId: mockTeam.id,
    firstName: "Nira",
    lastName: "Suwan",
    studentGen: "2026",
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
    studentGen: "2025",
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
    studentGen: "2026",
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
    studentGen: "2024",
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
      studentGen: String(2023 + (i % 4)),
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

// "ชั้นปี" isn't stored directly — derive it from studentGen (the admission
// year already used to compute the profile page's Gen ordinal).
export function getYearOfStudy(studentGen: string | null): string {
  const admissionYear = Number(studentGen);
  if (!studentGen || Number.isNaN(admissionYear)) return "-";
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

export type MonthlyAttendanceStats = {
  hours: number;
  lateCount: number;
  absentCount: number;
};

// yearMonth like "2026-08".
export function getMonthlyAttendanceStats(employeeId: string, yearMonth: string): MonthlyAttendanceStats {
  const records = getAttendanceForEmployee(employeeId).filter((r) => r.workDate.startsWith(yearMonth));

  const hours = records.reduce((sum, r) => {
    if (!r.checkInAt || !r.checkOutAt) return sum;
    return sum + (new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()) / 3_600_000;
  }, 0);

  return {
    hours: Math.round(hours * 10) / 10,
    lateCount: records.filter((r) => r.status === "สาย").length,
    absentCount: records.filter((r) => r.status === "ขาด").length,
  };
}

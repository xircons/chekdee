// Stand-in for the Go backend while it's not wired up yet — see PLAN.md
// Phase 1. Shapes mirror the tables in backend/db/migrations exactly
// (users, work_schedules, holidays, attendance_records, leave_requests)
// so swapping these fixtures for real API calls in Phase 4 is a
// find-and-replace of the accessor functions below, not a data model
// change.

export type Role = "system_owner" | "admin" | "supervisor" | "employee";
export type UserStatus = "active" | "inactive";

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
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  decidedBy: string | null;
  decidedAt: string | null;
};

export const mockTeam = { id: "team-1", name: "CAMT Front Desk" };

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
  },
];

export const mockWorkSchedules: MockWorkSchedule[] = [1, 2, 3, 4, 5].map((day) => ({
  id: `sched-${day}`,
  employeeId: "user-1",
  dayOfWeek: day,
  startTime: "09:00",
  endTime: "17:00",
  effectiveFrom: "2026-06-01",
  effectiveTo: null,
}));

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
  { id: "leave-1", employeeId: "user-1", startDate: "2026-08-20", endDate: "2026-08-21", reason: "Family event", status: "pending", decidedBy: null, decidedAt: null },
  { id: "leave-2", employeeId: "user-1", startDate: "2026-07-14", endDate: "2026-07-14", reason: "Doctor's appointment", status: "approved", decidedBy: "user-4", decidedAt: "2026-07-10T03:00:00Z" },
  { id: "leave-3", employeeId: "user-2", startDate: "2026-08-15", endDate: "2026-08-16", reason: "Personal", status: "pending", decidedBy: null, decidedAt: null },
  { id: "leave-4", employeeId: "user-3", startDate: "2026-06-02", endDate: "2026-06-03", reason: "Sick", status: "rejected", decidedBy: "user-4", decidedAt: "2026-06-01T03:00:00Z" },
];

// Placeholder policy — the real annual entitlement lives in the backend
// once leave accrual is implemented (Phase 4).
export const ANNUAL_LEAVE_DAYS = 10;

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

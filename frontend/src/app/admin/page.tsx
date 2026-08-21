"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileBarChart2 } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_BUTTON_CLASS, FIELD_CLASS } from "@/lib/admin-ui";
import { correctAttendanceStatus } from "@/lib/api-attendance";
import { type Employee, listEmployees } from "@/lib/api-employees";
import { approveLeaveRequest, listAllLeaveRequests, rejectLeaveRequest } from "@/lib/api-leave";
import { type DailyLogRow, getDailyLog } from "@/lib/api-reports";
import type { AttendanceStatus, MockLeaveRequest } from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn, formatThaiDateWithDay } from "@/lib/utils";

// The Thai-literal AttendanceStatus this page uses everywhere else ->
// the backend's English enum PATCH /attendance-records/:id/status expects.
function toBackendStatus(status: AttendanceStatus): "present" | "late" | "absent" {
  switch (status) {
    case "present":
      return "present";
    case "สาย":
      return "late";
    case "ขาด":
      return "absent";
  }
}

// The backend's English status enum only ever resolves to one of these
// three at check-in time ("pending" is a DB-default sentinel CheckIn never
// actually returns) -- maps 1:1 to the frontend's Thai-literal
// AttendanceStatus used everywhere else on this page.
function toAttendanceStatus(status: DailyLogRow["status"]): AttendanceStatus | null {
  switch (status) {
    case "present":
      return "present";
    case "late":
      return "สาย";
    case "absent":
      return "ขาด";
    default:
      return null;
  }
}

const PREVIEW_LIMIT = 4;
const RECENT_CHECKIN_LIMIT = 6;

const STATUS_LABEL_TH: Record<AttendanceStatus, string> = {
  present: "มาปกติ",
  สาย: "สาย",
  ขาด: "ขาด",
};

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// firstName/lastName are nullable on the real Employee (registration may not
// be complete yet) -- falls back to the LINE display name, then the id.
function employeeName(employee: Employee): string {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  return name || employee.lineDisplayName || employee.id;
}

function initials(employee: Employee): string {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.lineDisplayName;
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function relativeTimeTh(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  return `${hours} ชั่วโมงที่แล้ว`;
}

const correctionSchema = z.object({
  status: z.enum(["present", "สาย", "ขาด"] as const),
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผล"),
});

type CorrectionForm = z.infer<typeof correctionSchema>;

function CorrectionFormFields({
  currentStatus,
  onSubmit,
  onCancel,
}: {
  currentStatus: AttendanceStatus;
  onSubmit: (values: CorrectionForm) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CorrectionForm>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { status: currentStatus, reason: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>สถานะใหม่</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} modal={false}>
              <SelectTrigger className={`w-full ${FIELD_CLASS} data-[size=default]:h-9`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={4}>
                {(["present", "สาย", "ขาด"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABEL_TH[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">เหตุผล</Label>
        <Textarea
          id="reason"
          placeholder="เช่น พนักงานแจ้งลาป่วยทางโทรศัพท์ ยังไม่ได้ยื่นคำขอลาในระบบ"
          className="rounded-lg border-border bg-muted/40 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20"
          {...register("reason")}
        />
        {errors.reason && <p className="text-xs text-danger-foreground">{errors.reason.message}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
        >
          {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Built from today's GET /reports/daily-log rows -- a stored attendance
// record only exists once an employee has actually checked in, so unlike
// the old mock's getSimulatedRoster, this never includes employees who
// simply haven't checked in yet (the backend has no "no-show" status; ขาด
// here always means "checked in 60+ minutes late", per ComputeCheckInStatus).
type RosterEntry = {
  attendanceRecordId: string;
  employee: Employee;
  checkInAt: Date;
  status: AttendanceStatus;
};

type AttendanceIssue = {
  entry: RosterEntry;
  status: "ขาด" | "สาย";
};

const ISSUE_AVATAR_CLASS: Record<AttendanceIssue["status"], string> = {
  ขาด: "bg-danger text-danger-foreground",
  สาย: "bg-warning text-warning-foreground",
};

const ISSUE_BADGE_VARIANT: Record<AttendanceIssue["status"], "danger" | "warning"> = {
  ขาด: "danger",
  สาย: "warning",
};

// One priority-ordered list (ขาด first, then สาย — same-day attendance
// problems, ranked by urgency) instead of two separate cards, so scanning
// top to bottom already reflects what needs attention first.
function AttendanceIssuesCard({
  issues,
  onCorrect,
}: {
  issues: AttendanceIssue[];
  onCorrect: (entry: RosterEntry) => void;
}) {
  return (
    <Card className="rounded-2xl border border-slate-200 ring-0">
      <CardHeader>
        <CardTitle>ปัญหาการเข้างานวันนี้</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">วันนี้ยังไม่มีปัญหาการเข้างาน</p>
        ) : (
          issues.slice(0, PREVIEW_LIMIT).map(({ entry, status }) => (
            <div
              key={entry.employee.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    ISSUE_AVATAR_CLASS[status]
                  )}
                >
                  {initials(entry.employee)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {employeeName(entry.employee)}
                    </p>
                    <Badge variant={ISSUE_BADGE_VARIANT[status]}>{STATUS_LABEL_TH[status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    เช็คอิน{" "}
                    {entry.checkInAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className={`${ACTION_BUTTON_CLASS} shrink-0 border-slate-200 text-muted-foreground`}
                onClick={() => onCorrect(entry)}
              >
                แก้ไขสถานะ
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// This is an admin working page, not an unattended display (contrast the
// kiosk view's 1s tick) — sub-minute freshness isn't needed, so 60s keeps
// the roster reasonably current without re-rendering the page constantly.
const CLOCK_TICK_MS = 60_000;

export default function AdminDashboard() {
  const me = useMe();
  const [now, setNow] = useState<Date>(() => new Date());
  const todayIso = toIsoDateLocal(now);
  const monthIso = todayIso.slice(0, 7);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLogRow[]>([]);
  const [requests, setRequests] = useState<MockLeaveRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<RosterEntry | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Paused while the correction dialog is open, so a row's status can't
  // shift (or the entry vanish out of the list entirely) out from under the
  // admin mid-correction. Resumes once it closes.
  useEffect(() => {
    if (correctionTarget) return;
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [correctionTarget]);

  useEffect(() => {
    Promise.all([
      // Not role-filtered server-side: this list is also used below to
      // resolve a pending leave request's employee name (line ~435), and
      // supervisors/admins can legitimately submit leave requests too --
      // narrowing the fetch to role=employee would silently break that
      // lookup for their own requests (falls back to a raw UUID). The
      // headcount stat filters to role=employee client-side instead (see
      // activeEmployeeCount below). 200 is the backend's max page size (see
      // EmployeeUsecase.List) -- fine for this dashboard's summary stats at
      // the org's current size; a real "more than 200 employees" org would
      // need this to paginate.
      listEmployees({ status: "active", limit: 200 }),
      getDailyLog(monthIso),
      listAllLeaveRequests(),
    ])
      .then(([employeeResult, logRows, leaveRows]) => {
        setEmployees(employeeResult.employees);
        setTodayLog(logRows.filter((row) => row.date === todayIso));
        setRequests(leaveRows);
      })
      .catch((err: Error) => setLoadError(err.message));
    // Refetches when the calendar day/month rolls over, not on every 60s
    // clock tick -- the loaded data doesn't go stale minute to minute the
    // way the on-screen clock display does.
  }, [monthIso, todayIso]);

  const employeesById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // Matches GET /kiosk/roster-stats' own headcount (ListActiveEmployees,
  // role='employee' only) -- admin/supervisor/system_owner accounts don't
  // clock in and shouldn't count toward an attendance-relevant headcount.
  // Found via integration testing: kiosk showed 4, this dashboard showed
  // 10 for the same instant, because this list (unlike kiosk's) isn't
  // role-filtered -- see the fetch effect above for why it can't be.
  const activeEmployeeCount = employees.filter((e) => e.role === "employee").length;

  const roster: RosterEntry[] = useMemo(
    () =>
      todayLog.flatMap((row) => {
        const employee = employeesById.get(row.employeeId);
        const status = toAttendanceStatus(row.status);
        if (!employee || !status || !row.checkInAt) return [];
        return [{ attendanceRecordId: row.id, employee, checkInAt: new Date(row.checkInAt), status }];
      }),
    [todayLog, employeesById]
  );

  const absentToday = roster.filter((r) => r.status === "ขาด");
  const lateToday = roster.filter((r) => r.status === "สาย");
  const attendanceIssues: AttendanceIssue[] = [
    ...absentToday.map((entry) => ({ entry, status: "ขาด" as const })),
    ...lateToday.map((entry) => ({ entry, status: "สาย" as const })),
  ];

  const recentCheckins = [...roster]
    .sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime())
    .slice(0, RECENT_CHECKIN_LIMIT);

  const pendingRequests = requests.filter((r) => r.status === "pending");

  const decide = async (id: string, status: "approved" | "rejected") => {
    try {
      const decided = status === "approved" ? await approveLeaveRequest(id) : await rejectLeaveRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? decided : r)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  };

  const submitCorrection = async (values: CorrectionForm) => {
    if (!correctionTarget) return;
    setCorrectionError(null);
    try {
      const corrected = await correctAttendanceStatus(
        correctionTarget.attendanceRecordId,
        toBackendStatus(values.status),
        values.reason
      );
      setTodayLog((prev) =>
        prev.map((row) =>
          row.id === corrected.id
            ? { ...row, status: corrected.status as DailyLogRow["status"] }
            : row
        )
      );
      setCorrectionTarget(null);
    } catch (err) {
      // Dialog stays open, error shown inline -- the admin's typed reason
      // isn't lost on a failed submit.
      setCorrectionError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  };

  const quickStats = [
    { label: "เข้างานวันนี้", value: `${roster.length}/${activeEmployeeCount}` },
    { label: "คำขอลารออนุมัติ", value: String(pendingRequests.length) },
    { label: "ขาดวันนี้", value: String(absentToday.length) },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 pb-6">
      <header className="rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">
          ยินดีต้อนรับ, {me.first_name ?? me.display_name}
        </h1>
        <p className="mt-1 text-sm text-white/80">{formatThaiDateWithDay(now)}</p>

        <div className="mt-4 flex items-center gap-6">
          {quickStats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs text-white/80">{stat.label}</p>
            </div>
          ))}
        </div>
      </header>

      {loadError && (
        <p className="text-sm text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttendanceIssuesCard
          issues={attendanceIssues}
          onCorrect={(entry) => {
            setCorrectionError(null);
            setCorrectionTarget(entry);
          }}
        />

        <Card className="rounded-2xl border border-slate-200 ring-0">
          <CardHeader>
            <CardTitle>คำขอลารออนุมัติ</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีคำขอลารออนุมัติ</p>
            ) : (
              pendingRequests.slice(0, PREVIEW_LIMIT).map((request) => {
                const employee = employees.find((e) => e.id === request.employeeId);
                return (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {employee ? employeeName(employee) : request.employeeId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.leaveType ?? "-"} · {request.startDate}
                        {request.endDate !== request.startDate ? ` - ${request.endDate}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        className="cursor-pointer bg-success-foreground text-white hover:bg-success-foreground/90"
                        onClick={() => decide(request.id, "approved")}
                      >
                        อนุมัติ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => decide(request.id, "rejected")}
                      >
                        ปฏิเสธ
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
            {pendingRequests.length > PREVIEW_LIMIT && (
              <Link
                href="/admin/leave-requests"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                ดูทั้งหมด ({pendingRequests.length}) →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardHeader>
          <CardTitle>เช็คอินล่าสุด</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {recentCheckins.length > 0 ? (
            <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {recentCheckins.map((entry, index) => (
                <div
                  key={entry.employee.id}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-2", index === 0 && "bg-brand-100")}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-xs font-semibold text-success-foreground">
                    {initials(entry.employee)}
                  </div>
                  <p className="flex-1 truncate text-sm font-medium text-foreground">
                    {employeeName(entry.employee)}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {relativeTimeTh(entry.checkInAt, now)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ยังไม่มีการเช็คอินวันนี้</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <FileBarChart2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">รายงานการเข้างาน</p>
              <p className="text-xs text-muted-foreground">สรุปและส่งออกข้อมูลการเข้างานรายเดือน</p>
            </div>
          </div>
          <Link href="/admin/reports" className={cn(buttonVariants({ variant: "outline" }), ACTION_BUTTON_CLASS)}>
            ดูรายงาน
          </Link>
        </CardContent>
      </Card>

      <Dialog open={!!correctionTarget} onOpenChange={(open) => !open && setCorrectionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              แก้ไขสถานะของ {correctionTarget ? employeeName(correctionTarget.employee) : ""}
            </DialogTitle>
          </DialogHeader>
          {correctionError && (
            <p className="text-sm text-danger-foreground">{correctionError}</p>
          )}
          {correctionTarget && (
            <CorrectionFormFields
              currentStatus={correctionTarget.status}
              onSubmit={submitCorrection}
              onCancel={() => setCorrectionTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

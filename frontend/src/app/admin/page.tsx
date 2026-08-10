"use client";

import Link from "next/link";
import {
  CalendarOff,
  Check,
  ChevronRight,
  Clock,
  Minus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getActiveEmployees,
  getAttendanceForDate,
  getPendingLeaveRequests,
  mockLeaveRequests,
  type MockAttendanceRecord,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

type AttendanceState = "present" | "late" | "absent" | "pending";

const ATTENDANCE_ICON: Record<AttendanceState, LucideIcon> = {
  present: Check,
  late: Clock,
  absent: CalendarOff,
  pending: Minus,
};

const ATTENDANCE_STYLE: Record<AttendanceState, string> = {
  present: "bg-success text-success-foreground",
  late: "bg-warning text-warning-foreground",
  absent: "bg-danger text-danger-foreground",
  pending: "bg-muted text-muted-foreground",
};

const ATTENDANCE_LABEL: Record<AttendanceState, string> = {
  present: "Checked in",
  late: "Late",
  absent: "Absent",
  pending: "Not checked in yet",
};

function classifyAttendance(record: MockAttendanceRecord | undefined): AttendanceState {
  if (!record) return "pending";
  if (record.status === "สาย") return "late";
  if (record.status === "ขาด") return "absent";
  return "present";
}

function employeeName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`;
}

function formatDateRange(startDate: string, endDate: string): string {
  const format = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" });
  return startDate === endDate ? format(startDate) : `${format(startDate)} - ${format(endDate)}`;
}

export default function AdminDashboard() {
  const me = useMe();

  const todayIso = new Date().toISOString().slice(0, 10);
  const employees = getActiveEmployees();
  const todaysAttendance = getAttendanceForDate(todayIso);
  const attendanceByEmployee = new Map(todaysAttendance.map((r) => [r.employeeId, r]));

  const rows = employees.map((employee) => ({
    employee,
    state: classifyAttendance(attendanceByEmployee.get(employee.id)),
  }));

  const presentCount = rows.filter((r) => r.state === "present" || r.state === "late").length;
  const attendanceRate = employees.length > 0 ? Math.round((presentCount / employees.length) * 100) : 0;

  const pendingRequests = getPendingLeaveRequests();
  const recentPending = pendingRequests
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3);

  const stats = [
    { label: "Team size", value: employees.length },
    { label: "Attendance today", value: `${attendanceRate}%` },
    { label: "Open requests", value: pendingRequests.length },
    { label: "Total requests", value: mockLeaveRequests.length },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <AdminPageHeader
        title={`Welcome, ${me.first_name ?? me.display_name}`}
        subtitle="Here's how your team is doing today."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-brand-900 tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Today&apos;s attendance</p>
                <p className="text-xs text-muted-foreground">Who&apos;s in, who&apos;s not, at a glance</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <Users className="size-4" />
              </div>
            </div>

            <div className="flex flex-col">
              {rows.map(({ employee, state }) => {
                const Icon = ATTENDANCE_ICON[state];
                return (
                  <div
                    key={employee.id}
                    className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                  >
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        ATTENDANCE_STYLE[state]
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <p className="flex-1 text-sm font-medium text-foreground">
                      {employeeName(employee)}
                    </p>
                    <p className="text-xs text-muted-foreground">{ATTENDANCE_LABEL[state]}</p>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">No active employees yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Pending leave requests</p>
              <Badge variant={pendingRequests.length > 0 ? "warning" : "secondary"}>
                {pendingRequests.length}
              </Badge>
            </div>

            {recentPending.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentPending.map((request) => {
                  const employee = employees.find((e) => e.id === request.employeeId);
                  return (
                    <div key={request.id} className="rounded-xl bg-slate-50 px-3.5 py-3">
                      <p className="text-sm font-medium text-foreground">
                        {employee ? employeeName(employee) : request.employeeId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.leaveType ?? "Leave"} · {formatDateRange(request.startDate, request.endDate)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pending requests right now.</p>
            )}

            <Link
              href="/admin/leave-requests"
              className="flex items-center gap-1 text-sm font-medium text-brand-600"
            >
              View all requests
              <ChevronRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

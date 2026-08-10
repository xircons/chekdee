"use client";

import Link from "next/link";
import {
  Calendar,
  Check,
  Clock,
  FileText,
  Minus,
  Moon,
  QrCode,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

import { EmployeePageHeader } from "@/components/employee-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTodayAttendance, type TodayAttendance } from "@/lib/attendance-store";
import {
  getAttendanceForEmployee,
  getWorkScheduleForEmployee,
  mockEmployees,
  ROLE_LABEL_TH,
  type MockAttendanceRecord,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { href: "/leave", label: "ขอลา", icon: FileText },
  { href: "/schedule", label: "ตารางงาน", icon: Calendar },
  { href: "/profile", label: "โปรไฟล์", icon: User },
];

const WEEKDAY_LABELS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

type DayIconStatus = "present" | "late" | "absent" | "future" | "dayoff";

const DAY_ICON: Record<DayIconStatus, LucideIcon> = {
  present: Check,
  late: Clock,
  absent: X,
  future: Minus,
  dayoff: Moon,
};

const DAY_ICON_STYLE: Record<DayIconStatus, string> = {
  present: "bg-success text-success-foreground",
  late: "bg-warning text-warning-foreground",
  absent: "bg-danger text-danger-foreground",
  future: "bg-muted text-muted-foreground",
  dayoff: "bg-muted/40 text-muted-foreground/50",
};

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(first: string | null, last: string | null, fallback: string | null): string {
  if (first || last) {
    return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  }
  return (fallback ?? "?").slice(0, 2).toUpperCase();
}

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Monday-first dates for the week containing `reference`.
function getWeekDates(reference: Date): Date[] {
  const mondayOffset = reference.getDay() === 0 ? -6 : 1 - reference.getDay();
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function classifyDay(
  date: Date,
  todayIso: string,
  workingDays: Set<number>,
  attendanceByDate: Map<string, MockAttendanceRecord>,
  todayAttendance: TodayAttendance
): DayIconStatus {
  const iso = toIsoDateLocal(date);
  // Day-off is a schedule fact independent of time; "future" only means a
  // scheduled workday that hasn't happened yet, so day-off takes priority
  // even for days later in the week.
  if (!workingDays.has(date.getDay())) return "dayoff";
  if (iso > todayIso) return "future";
  if (iso === todayIso) return todayAttendance.checkInAt ? "present" : "future";

  const record = attendanceByDate.get(iso);
  if (record?.status === "present") return "present";
  if (record?.status === "สาย") return "late";
  if (record?.status === "ขาด") return "absent";
  return "future";
}

export default function EmployeeHome() {
  const me = useMe();
  const { today } = useTodayAttendance();

  const now = new Date();
  const todayIso = toIsoDateLocal(now);

  const mockProfile = mockEmployees.find((e) => e.id === me.id);
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.display_name || "—";

  const statusLabel = !today.checkInAt ? "ยังไม่เข้างาน" : !today.checkOutAt ? "เข้างานแล้ว" : "ออกงานแล้ว";

  const workingDays = new Set(getWorkScheduleForEmployee(me.id).map((s) => s.dayOfWeek));
  const attendanceByDate = new Map(getAttendanceForEmployee(me.id).map((r) => [r.workDate, r]));
  const weekDays = getWeekDates(now).map((date, i) => ({
    date,
    label: WEEKDAY_LABELS_TH[i],
    status: classifyDay(date, todayIso, workingDays, attendanceByDate, today),
  }));

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader
        title={`สวัสดี, ${me.first_name ?? me.display_name}`}
        subtitle="ระบบบันทึกเวลาทำงาน turnPRO, Chiang Mai University"
      />

      <div className="flex flex-col gap-6 px-6 pb-6">
        <Card className="-mt-6 rounded-2xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-600">
              {initials(me.first_name, me.last_name, me.display_name)}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {fullName}
                {mockProfile?.nickname && (
                  <span className="font-normal text-muted-foreground"> ({mockProfile.nickname})</span>
                )}
              </p>
              <Badge variant="secondary" className="mt-1">
                {ROLE_LABEL_TH[me.role]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center ring-1 ring-foreground/10 transition-transform active:scale-95"
              >
                <div className="flex size-11 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <Icon className="size-5" />
                </div>
                <p className="text-xs font-medium text-foreground">{action.label}</p>
              </Link>
            );
          })}
        </div>

        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">สถานะวันนี้</p>
                <p className="text-base font-bold text-foreground">{statusLabel}</p>
              </div>
              <Link
                href="/check-in/scan"
                className="flex size-[90px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-accent-600 text-white transition-transform active:scale-95"
              >
                <QrCode className="size-6" />
                <span className="text-xs font-semibold">สแกน QR</span>
              </Link>
            </div>

            <div className="border-t border-border" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">เวลาเข้างาน</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatTime(today.checkInAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">เวลาออกงาน</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatTime(today.checkOutAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-4 p-5">
            <p className="text-sm font-semibold text-foreground">สรุปการเข้างานสัปดาห์นี้</p>
            <div className="flex justify-between">
              {weekDays.map((day) => {
                const Icon = DAY_ICON[day.status];
                return (
                  <div key={day.label + day.date.getDate()} className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full",
                        DAY_ICON_STYLE[day.status]
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{day.label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

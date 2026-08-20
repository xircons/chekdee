"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarRange,
  Check,
  Clock,
  FileText,
  LogOut,
  Minus,
  Moon,
  QrCode,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

import { DetailModal, DetailModalInfoBlock, type DetailModalBadgeVariant } from "@/components/detail-modal";
import { EmployeeListRow } from "@/components/employee-list-row";
import { EmployeePageHeader } from "@/components/employee-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTodayAttendance, type TodayAttendance } from "@/lib/attendance-store";
import { buildLeaveRequestEmail } from "@/lib/leave-email";
import {
  getAttendanceForEmployee,
  getLeaveRequestsForEmployee,
  getWorkScheduleForEmployee,
  mockEmployees,
  ROLE_LABEL_TH,
  type MockAttendanceRecord,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn, formatThaiDate, formatThaiDateRange } from "@/lib/utils";

const QUICK_ACTIONS = [
  { href: "/leave", label: "ขอลา", icon: FileText },
  { href: "/schedule", label: "ตารางงาน", icon: Calendar },
  { href: "/profile", label: "โปรไฟล์", icon: User },
];

const WEEKDAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type DayIconStatus = "present" | "late" | "absent" | "future" | "dayoff";

type WeekDay = {
  date: Date;
  isoDate: string;
  label: string;
  status: DayIconStatus;
  isToday: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
};

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

const DAY_STATUS_LABEL_TH: Record<DayIconStatus, string> = {
  present: "ตรงเวลา",
  late: "มาสาย",
  absent: "ขาดงาน",
  future: "ยังไม่ถึงวันนี้",
  dayoff: "วันหยุด",
};

const DAY_STATUS_BADGE_VARIANT: Record<DayIconStatus, DetailModalBadgeVariant> = {
  present: "success",
  late: "warning",
  absent: "danger",
  future: "secondary",
  dayoff: "secondary",
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

// Sunday-first dates for the week containing `reference`.
function getWeekDates(reference: Date): Date[] {
  const sunday = new Date(reference);
  sunday.setDate(reference.getDate() - reference.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
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

// Consecutive on-time days counted back from the most recent day that's
// already happened this week — day-off and not-yet-happened days are
// skipped rather than breaking the streak, since they're not misses.
function computeOnTimeStreak(weekDays: WeekDay[]): number {
  let streak = 0;
  for (let i = weekDays.length - 1; i >= 0; i--) {
    const status = weekDays[i].status;
    if (status === "dayoff" || status === "future") continue;
    if (status === "present") {
      streak++;
      continue;
    }
    break;
  }
  return streak;
}

export default function EmployeeHome() {
  const me = useMe();
  const { today, checkOut } = useTodayAttendance();
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const now = new Date();
  const todayIso = toIsoDateLocal(now);

  const mockProfile = mockEmployees.find((e) => e.id === me.id);
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.display_name || "—";

  const statusLabel = !today.checkInAt ? "ยังไม่เข้างาน" : !today.checkOutAt ? "เข้างานแล้ว" : "ออกงานแล้ว";

  const workingDays = new Set(getWorkScheduleForEmployee(me.id).map((s) => s.dayOfWeek));
  const attendanceByDate = new Map(getAttendanceForEmployee(me.id).map((r) => [r.workDate, r]));
  const weekDays: WeekDay[] = getWeekDates(now).map((date, i) => {
    const isoDate = toIsoDateLocal(date);
    const status = classifyDay(date, todayIso, workingDays, attendanceByDate, today);
    const record = attendanceByDate.get(isoDate);
    return {
      date,
      isoDate,
      label: WEEKDAY_LABELS_TH[i],
      status,
      isToday: isoDate === todayIso,
      checkInAt: isoDate === todayIso ? today.checkInAt : (record?.checkInAt ?? null),
      checkOutAt: isoDate === todayIso ? today.checkOutAt : (record?.checkOutAt ?? null),
    };
  });

  const onTimeStreak = computeOnTimeStreak(weekDays);

  const pendingRequest = getLeaveRequestsForEmployee(me.id)
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const pendingRequestSubject = pendingRequest
    ? buildLeaveRequestEmail({
      employeeName: fullName,
      yearOfStudy: "",
      studentId: "",
      phoneNumber: "",
      leaveType: pendingRequest.leaveType ?? "",
      startDate: pendingRequest.startDate,
      endDate: pendingRequest.endDate,
      reason: pendingRequest.reason ?? "",
    }).subject
    : "";

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader
        title={`สวัสดี, ${me.first_name ?? me.display_name}`}
        subtitle="ระบบบันทึกเวลาทำงาน turnPRO, Chiang Mai University"
      />

      <div className="flex flex-1 flex-col gap-5 px-6 pb-6">
        <Card className="-mt-6 rounded-2xl border border-slate-200 py-0 ring-0">
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

        <Card className="rounded-2xl border border-slate-200 py-0 ring-0">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">สถานะวันนี้</p>
                <p className="text-base font-bold text-foreground">{statusLabel}</p>
              </div>
              {!today.checkInAt ? (
                <Link
                  href="/check-in/scan"
                  className="flex size-[90px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-accent-600 text-white transition-transform active:scale-95"
                >
                  <QrCode className="size-6" />
                  <span className="text-xs font-semibold">สแกน QR</span>
                </Link>
              ) : !today.checkOutAt ? (
                <Button
                  onClick={() => checkOut()}
                  className="flex size-[90px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-accent-600 text-white transition-transform hover:bg-accent-700 active:scale-95"
                >
                  <LogOut className="size-6" />
                  <span className="text-xs font-semibold">ออกงาน</span>
                </Button>
              ) : (
                <div className="flex size-[90px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-success text-success-foreground">
                  <Check className="size-6 animate-in zoom-in-50 duration-150" strokeWidth={3} />
                  <span className="text-xs font-semibold animate-in fade-in-0 zoom-in-50 duration-150">
                    เสร็จสิ้น
                  </span>
                </div>
              )}
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

        <Card className="rounded-2xl border border-slate-200 py-0 ring-0">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">สรุปการเข้างานสัปดาห์นี้</p>
              {onTimeStreak > 1 && (
                <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">
                  ตรงเวลา {onTimeStreak} วันติด
                </span>
              )}
            </div>
            <div className="flex justify-between">
              {weekDays.map((day) => {
                const Icon = DAY_ICON[day.status];
                return (
                  <button
                    key={day.isoDate}
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setDayModalOpen(true);
                    }}
                    className="flex flex-col items-center gap-1.5 transition-transform active:scale-90 cursor-pointer"
                  >
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full",
                        DAY_ICON_STYLE[day.status]
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{day.label}</p>
                  </button>
                );
              })}
            </div>

            {pendingRequest && (
              <>
                <div className="border-t border-border" />
                <EmployeeListRow
                  icon={CalendarRange}
                  label={`คำขอลา ${formatThaiDateRange(pendingRequest.startDate, pendingRequest.endDate)}`}
                  sublabel={pendingRequest.reason ?? undefined}
                  trailing={<Badge variant="warning">รอดำเนินการ</Badge>}
                  onClick={() => setRequestModalOpen(true)}
                  className="border-b-0 py-0"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <DetailModal
        open={dayModalOpen}
        onOpenChange={setDayModalOpen}
        size="compact"
        icon={selectedDay ? DAY_ICON[selectedDay.status] : Clock}
        title={selectedDay ? formatThaiDate(selectedDay.date) : ""}
        badgeText={
          selectedDay
            ? DAY_STATUS_LABEL_TH[selectedDay.status] + (selectedDay.isToday ? " · วันนี้" : "")
            : ""
        }
        badgeVariant={selectedDay ? DAY_STATUS_BADGE_VARIANT[selectedDay.status] : "default"}
        footer={
          <Button
            className="h-11 w-full rounded-full bg-accent-600 font-semibold text-white hover:bg-accent-700"
            onClick={() => setDayModalOpen(false)}
          >
            ตกลง
          </Button>
        }
      >
        {selectedDay && (selectedDay.status === "present" || selectedDay.status === "late") ? (
          <div className="grid grid-cols-2 gap-3">
            <DetailModalInfoBlock
              label="เวลาเข้างาน"
              value={formatTime(selectedDay.checkInAt)}
              valueSize="sm"
            />
            <DetailModalInfoBlock
              label="เวลาออกงาน"
              value={formatTime(selectedDay.checkOutAt)}
              valueSize="sm"
            />
          </div>
        ) : (
          <DetailModalInfoBlock
            label="สถานะ"
            value={
              selectedDay?.status === "absent"
                ? "ขาดงานในวันนี้"
                : selectedDay?.status === "dayoff"
                  ? "ไม่มีตารางทำงานในวันนี้"
                  : "ยังไม่ถึงวันนี้"
            }
            valueSize="sm"
          />
        )}
      </DetailModal>

      <DetailModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        size="compact"
        icon={CalendarRange}
        title={pendingRequestSubject}
        badgeText="รอดำเนินการ"
        badgeVariant="warning"
        footer={
          <Button
            className="h-11 w-full rounded-full bg-accent-600 font-semibold text-white hover:bg-accent-700"
            onClick={() => setRequestModalOpen(false)}
          >
            ตกลง
          </Button>
        }
      >
        <DetailModalInfoBlock label="เหตุผล" value={pendingRequest?.reason ?? "-"} valueSize="sm" />
      </DetailModal>
    </div>
  );
}

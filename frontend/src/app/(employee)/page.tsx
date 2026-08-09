"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Clock, FileText, Umbrella, User } from "lucide-react";

import { EmployeePageHeader } from "@/components/employee-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTodayAttendance } from "@/lib/attendance-store";
import {
  ANNUAL_LEAVE_DAYS,
  getLeaveBalance,
  getUpcomingHolidays,
  mockEmployees,
} from "@/lib/mock-data";
import { useMe, type Role } from "@/lib/session";

const ROLE_LABEL_TH: Record<Role, string> = {
  employee: "พนักงาน",
  supervisor: "หัวหน้างาน",
  admin: "ผู้ดูแลระบบ",
  system_owner: "เจ้าของระบบ",
};

const QUICK_ACTIONS = [
  { href: "/leave", label: "ขอลา", icon: FileText },
  { href: "/schedule", label: "ตารางงาน", icon: Calendar },
  { href: "/profile", label: "โปรไฟล์", icon: User },
];

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatHolidayDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(first: string | null, last: string | null, fallback: string | null): string {
  if (first || last) {
    return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  }
  return (fallback ?? "?").slice(0, 2).toUpperCase();
}

export default function EmployeeHome() {
  const me = useMe();
  const router = useRouter();
  const { today, checkIn, checkOut } = useTodayAttendance();

  const now = new Date();
  const leaveBalance = getLeaveBalance(me.id, now.getFullYear());
  const upcomingHolidays = getUpcomingHolidays(now.toISOString().slice(0, 10));
  const nextHoliday = upcomingHolidays[0];

  const mockProfile = mockEmployees.find((e) => e.id === me.id);
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.display_name || "—";

  const isDone = Boolean(today.checkInAt && today.checkOutAt);
  const statusLabel = !today.checkInAt ? "ยังไม่เข้างาน" : !today.checkOutAt ? "เข้างานแล้ว" : "ออกงานแล้ว";
  const ctaLabel = today.checkInAt && !today.checkOutAt ? "ออกงาน" : "เข้างาน";

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader
        title={`สวัสดี, ${me.first_name ?? me.display_name}`}
        subtitle="ระบบบันทึกเวลาทำงาน CAMT, Chiang Mai University"
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
                className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center ring-1 ring-foreground/10"
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
                <p className="text-xs text-muted-foreground">สถานะ</p>
                <p className="text-base font-bold text-foreground">{statusLabel}</p>
              </div>
              {isDone && <Badge variant="success">เสร็จสิ้นวันนี้</Badge>}
            </div>

            {!isDone && (
              <Button
                className="h-14 w-full gap-2 rounded-2xl bg-accent-600 px-6 text-base font-semibold text-white hover:bg-accent-700"
                onClick={today.checkInAt ? checkOut : checkIn}
              >
                <Clock className="size-5" />
                {ctaLabel}
              </Button>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <p className="text-xs text-muted-foreground">เวลาเข้างาน</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatTime(today.checkInAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">เวลาออกงาน</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatTime(today.checkOutAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-2xl bg-brand-900 text-white">
            <CardContent className="flex flex-col p-5">
              <p className="text-xs text-white/70">วันหยุดที่จะถึง</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{upcomingHolidays.length}</p>
              {nextHoliday ? (
                <p className="mt-2 text-sm font-medium">
                  {nextHoliday.localName ?? nextHoliday.name} · {formatHolidayDate(nextHoliday.date)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/70">ไม่มีวันหยุดที่จะถึง</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-fit self-start text-white hover:bg-white/10 hover:text-white"
                onClick={() => router.push("/schedule")}
              >
                ดูทั้งหมด
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="flex flex-col p-5">
              <div className="flex items-center gap-1.5 text-brand-600">
                <Umbrella className="size-4" />
                <p className="text-xs font-medium text-muted-foreground">วันลาคงเหลือ</p>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {leaveBalance}
                <span className="text-sm font-normal text-muted-foreground"> / {ANNUAL_LEAVE_DAYS} วัน</span>
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{
                    width: `${Math.max(0, Math.min(100, (leaveBalance / ANNUAL_LEAVE_DAYS) * 100))}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

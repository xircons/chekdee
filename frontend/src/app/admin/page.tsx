"use client";

import { useEffect, useMemo, useState } from "react";
import { QrCode } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  getActiveEmployees,
  getPendingLeaveRequests,
  getUpcomingHolidays,
  getWorkScheduleForEmployee,
  type MockEmployee,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn, formatThaiDateWithDay } from "@/lib/utils";

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function initials(employee: MockEmployee): string {
  return `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();
}

function employeeName(employee: MockEmployee): string {
  return `${employee.firstName} ${employee.lastName}`;
}

// Simple deterministic hash so the same employee gets the same simulated
// check-in behavior all day (stable across re-renders/ticks) but a
// different mix on different days — there's no real "who's checked in
// right now" data source yet (Phase 4), so this stands in for one.
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function relativeTimeTh(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  return `${hours} ชั่วโมงที่แล้ว`;
}

type RosterEntry = {
  employee: MockEmployee;
  scheduledStart: Date;
  checkedIn: boolean;
  checkInAt: Date | null;
};

const ROSTER_SCROLL_THRESHOLD = 8;
const RECENT_CHECKIN_LIMIT = 8;

export default function AdminDashboard() {
  const me = useMe();
  // Ticks once a second for the live clock; the initial value is set here
  // rather than in the effect body so there's no synchronous setState on
  // mount — the effect only schedules the recurring update.
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const employees = useMemo(() => getActiveEmployees(), []);

  const todayIso = toIsoDateLocal(now);
  const todayDow = now.getDay();

  const roster: RosterEntry[] = useMemo(() => {
    return employees.flatMap((employee) => {
      const schedule = getWorkScheduleForEmployee(employee.id).find((s) => s.dayOfWeek === todayDow);
      if (!schedule) return [];

      const [h, m] = schedule.startTime.split(":").map(Number);
      const scheduledStart = new Date(now);
      scheduledStart.setHours(h, m, 0, 0);

      // Deterministic per employee+day: ~65% simulated attendance, plus a
      // small +/- offset around their scheduled start for the check-in feed.
      const roll = hashSeed(employee.id + todayIso) % 100;
      const offsetMinutes = (hashSeed(employee.id + todayIso + "offset") % 40) - 15;
      const simulatedCheckInAt = new Date(scheduledStart.getTime() + offsetMinutes * 60_000);
      // Can't have "checked in" at a point still in the future relative to
      // the live clock — treat those as not-yet-arrived until that time comes.
      const checkedIn = roll < 65 && simulatedCheckInAt <= now;

      return [
        {
          employee,
          scheduledStart,
          checkedIn,
          checkInAt: checkedIn ? simulatedCheckInAt : null,
        },
      ];
    });
  }, [employees, now, todayIso, todayDow]);

  const checkedInEntries = roster.filter((r) => r.checkedIn);
  const notYetEntries = roster
    .filter((r) => !r.checkedIn)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  const overdueCount = notYetEntries.filter((r) => r.scheduledStart < now).length;

  const pendingRequests = getPendingLeaveRequests();

  const nextHoliday = getUpcomingHolidays(todayIso)[0];
  const daysToHoliday = nextHoliday
    ? Math.round(
        (new Date(`${nextHoliday.date}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) /
          86_400_000
      )
    : null;

  const recentCheckins = checkedInEntries
    .filter((r): r is RosterEntry & { checkInAt: Date } => r.checkInAt !== null)
    .sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime())
    .slice(0, RECENT_CHECKIN_LIMIT);

  const stats = [
    {
      label: "จำนวนผู้เข้างานวันนี้",
      value: `${checkedInEntries.length}/${employees.length}`,
      tint: false,
    },
    {
      label: "คำขอลารออนุมัติ",
      value: String(pendingRequests.length),
      tint: false,
    },
    {
      label: "เลยเวลาเข้างานแล้ว",
      value: String(overdueCount),
      tint: true,
    },
    {
      label: "วันหยุดถัดไป",
      value: nextHoliday
        ? `${nextHoliday.localName ?? nextHoliday.name} · อีก ${daysToHoliday} วัน`
        : "ไม่มีวันหยุดที่จะถึง",
      tint: false,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="relative overflow-hidden rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <div className="absolute top-0 right-0 size-40 -translate-y-1/3 translate-x-1/4 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">
              ยินดีต้อนรับ, {me.first_name ?? me.display_name}
            </h1>
            <p className="mt-1 text-sm text-white/80">สรุปข้อมูลการเข้างานของทีมประจำวันนี้</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold tabular-nums">
              {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="mt-1 text-sm text-white/80">{formatThaiDateWithDay(now)}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className={cn("rounded-2xl border border-slate-200", stat.tint && "bg-accent-100")}>
            <CardContent className="p-4">
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  stat.tint ? "text-accent-700" : "text-brand-900"
                )}
              >
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200 lg:col-span-2">
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="text-sm font-semibold text-foreground">รายชื่อพนักงานวันนี้</p>

            {roster.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">ไม่มีพนักงานที่มีตารางงานในวันนี้</p>
            ) : (
              <>
                {checkedInEntries.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-success px-3.5 py-2.5 text-success-foreground">
                    <div className="flex size-6 items-center justify-center rounded-full bg-white/60 text-xs font-bold">
                      {checkedInEntries.length}
                    </div>
                    <p className="text-sm font-medium">เช็คอินแล้ว {checkedInEntries.length} คน</p>
                  </div>
                )}

                <div
                  className={cn(
                    "flex flex-col",
                    notYetEntries.length > ROSTER_SCROLL_THRESHOLD && "max-h-[420px] overflow-y-auto"
                  )}
                >
                  {notYetEntries.map(({ employee, scheduledStart }) => {
                    const overdueMinutes = Math.round((now.getTime() - scheduledStart.getTime()) / 60_000);
                    return (
                      <div
                        key={employee.id}
                        className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-600">
                          {initials(employee)}
                        </div>
                        <p className="flex-1 text-sm font-medium text-foreground">
                          {employeeName(employee)}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            overdueMinutes > 0 ? "font-medium text-accent-700" : "text-muted-foreground"
                          )}
                        >
                          {overdueMinutes > 0
                            ? `เลยเวลา ${overdueMinutes} นาที`
                            : scheduledStart.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    );
                  })}
                  {notYetEntries.length === 0 && (
                    <p className="py-4 text-sm text-muted-foreground">ทุกคนเช็คอินแล้ว</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="rounded-2xl border border-slate-200">
            <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
              <div className="flex size-28 items-center justify-center rounded-2xl border-2 border-dashed border-brand-600/40 text-brand-600">
                <QrCode className="size-14" />
              </div>
              <p className="text-sm font-semibold text-foreground">สแกนเพื่อบันทึกเวลาเข้างาน</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200">
            <CardContent className="flex flex-col gap-3 p-5">
              <p className="text-sm font-semibold text-foreground">เช็คอินล่าสุด</p>
              {recentCheckins.length > 0 ? (
                <div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto">
                  {recentCheckins.map(({ employee, checkInAt }, index) => (
                    <div
                      key={employee.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2",
                        index === 0 && "bg-brand-100"
                      )}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-600">
                        {initials(employee)}
                      </div>
                      <p className="flex-1 truncate text-sm font-medium text-foreground">
                        {employeeName(employee)}
                      </p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {relativeTimeTh(checkInAt, now)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ยังไม่มีการเช็คอินวันนี้</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

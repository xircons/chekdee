"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QrCode } from "lucide-react";

import { AdminBubbleChart, type BubbleEntry } from "@/components/admin-bubble-chart";
import { Card, CardContent } from "@/components/ui/card";
import {
  MOCK_MONTHLY_ON_TIME,
  getActiveEmployees,
  getEmployeesOnLeave,
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

const RECENT_CHECKIN_LIMIT = 6;
const ON_TIME_RING_SIZE = 80;
const ON_TIME_RING_RADIUS = 34;
const ON_TIME_RING_STROKE = 8;
const DEMO_LOOP_INTERVAL_MS = 2500;

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
  const overdueCount = roster.filter((r) => !r.checkedIn && r.scheduledStart < now).length;

  const pendingRequests = getPendingLeaveRequests();
  const leaveTodayCount = getEmployeesOnLeave(todayIso).length;

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

  // Bubble-pack visualization: one bubble per person who's either already
  // checked in (green) or scheduled but late (amber). Anyone whose start
  // time hasn't arrived yet gets no bubble.
  const bubbleEntries: BubbleEntry[] = useMemo(
    () =>
      roster
        .filter((r) => r.checkedIn || r.scheduledStart < now)
        .map((r) => ({
          id: r.employee.id,
          initials: initials(r.employee),
          pictureUrl: r.employee.pictureUrl,
          status: r.checkedIn ? ("checked-in" as const) : ("late" as const),
        })),
    [roster, now]
  );

  // There's no live check-in event stream yet (Phase 4 backend), so this
  // loop stands in for one: it keeps revealing bubbles for people not
  // already shown so the pop-in animation has something to demo. Once
  // everyone's shown, it clears and starts over. Replace with real
  // event-driven updates once attendance is wired up.
  const bubbleEntriesRef = useRef(bubbleEntries);
  useEffect(() => {
    bubbleEntriesRef.current = bubbleEntries;
  }, [bubbleEntries]);

  const [demoEntries, setDemoEntries] = useState<Map<string, "checked-in" | "late">>(new Map());

  useEffect(() => {
    const timer = setInterval(() => {
      setDemoEntries((prev) => {
        const shownIds = new Set([...bubbleEntriesRef.current.map((e) => e.id), ...prev.keys()]);
        const candidates = employees.filter((e) => !shownIds.has(e.id));
        if (candidates.length === 0) return new Map();

        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const status: "checked-in" | "late" = Math.random() < 0.7 ? "checked-in" : "late";
        return new Map(prev).set(pick.id, status);
      });
    }, DEMO_LOOP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [employees]);

  const displayEntries: BubbleEntry[] = useMemo(() => {
    const extra: BubbleEntry[] = [];
    demoEntries.forEach((status, id) => {
      if (bubbleEntries.some((e) => e.id === id)) return;
      const employee = employees.find((e) => e.id === id);
      if (!employee) return;
      extra.push({ id, initials: initials(employee), pictureUrl: employee.pictureUrl, status });
    });
    return [...bubbleEntries, ...extra];
  }, [bubbleEntries, demoEntries, employees]);

  const quickStats = [
    { label: "เข้างานวันนี้", value: `${checkedInEntries.length}/${employees.length}` },
    { label: "คำขอลารออนุมัติ", value: String(pendingRequests.length) },
    { label: "เลยเวลาเข้างาน", value: String(overdueCount) },
  ];

  const onTimeCircumference = 2 * Math.PI * ON_TIME_RING_RADIUS;
  const onTimeOffset = onTimeCircumference * (1 - MOCK_MONTHLY_ON_TIME.percent / 100);

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col gap-5 px-6 pb-6">
      <header className="relative shrink-0 overflow-hidden rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <div className="absolute top-0 right-0 size-48 -translate-y-1/3 translate-x-1/4 rounded-full bg-white/15" />
        <div className="relative flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">
              ยินดีต้อนรับ, {me.first_name ?? me.display_name}
            </h1>
            <p className="mt-1 text-sm text-white/80">สรุปข้อมูลการเข้างานของทีมประจำวันนี้</p>

            <div className="mt-4 flex items-center gap-6">
              {quickStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                  <p className="text-xs text-white/80">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-5xl font-bold tabular-nums">
              {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="mt-1 text-sm text-white/80">{formatThaiDateWithDay(now)}</p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex min-h-0 flex-col rounded-2xl border border-slate-200 lg:col-span-2">
          <CardContent className="flex min-h-0 flex-1 flex-col p-5">
            <p className="text-sm font-semibold text-foreground">แผนผังการแสดงตน</p>
            <AdminBubbleChart entries={displayEntries} />
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="rounded-2xl border border-brand-600/10 bg-brand-100">
            <CardContent className="flex items-center gap-4 p-4">
              {/* p-4 is the QR's quiet zone — the white background must stay
                  clear of the tinted card so scanners can lock onto the code. */}
              <div className="flex size-32 shrink-0 items-center justify-center rounded-xl bg-white p-4 text-brand-600">
                <QrCode className="size-full" />
              </div>
              <p className="text-sm font-semibold text-brand-900">สแกนเพื่อบันทึกเวลาเข้างาน</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="relative shrink-0" style={{ width: ON_TIME_RING_SIZE, height: ON_TIME_RING_SIZE }}>
                <svg
                  viewBox={`0 0 ${ON_TIME_RING_SIZE} ${ON_TIME_RING_SIZE}`}
                  className="-rotate-90"
                  width={ON_TIME_RING_SIZE}
                  height={ON_TIME_RING_SIZE}
                >
                  <circle
                    cx={ON_TIME_RING_SIZE / 2}
                    cy={ON_TIME_RING_SIZE / 2}
                    r={ON_TIME_RING_RADIUS}
                    stroke="var(--border)"
                    strokeWidth={ON_TIME_RING_STROKE}
                    fill="none"
                  />
                  <circle
                    cx={ON_TIME_RING_SIZE / 2}
                    cy={ON_TIME_RING_SIZE / 2}
                    r={ON_TIME_RING_RADIUS}
                    stroke="var(--success-foreground)"
                    strokeWidth={ON_TIME_RING_STROKE}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={onTimeCircumference}
                    strokeDashoffset={onTimeOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand-900">
                  {MOCK_MONTHLY_ON_TIME.percent}%
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">ตรงเวลาเดือนนี้</p>
                <p className="mt-1 text-xs text-muted-foreground">{MOCK_MONTHLY_ON_TIME.totalCheckIns} ครั้ง</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="rounded-2xl border border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">ลาวันนี้</p>
                <p className="mt-1 text-lg font-bold text-brand-900">{leaveTodayCount} คน</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">วันหยุดถัดไป</p>
                <p className="mt-1 text-sm font-semibold text-brand-900">
                  {nextHoliday
                    ? `${nextHoliday.localName ?? nextHoliday.name} · อีก ${daysToHoliday} วัน`
                    : "ไม่มีวันหยุดที่จะถึง"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-5">
              <p className="shrink-0 text-sm font-semibold text-foreground">เช็คอินล่าสุด</p>
              {recentCheckins.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
                  {recentCheckins.map(({ employee, checkInAt }, index) => (
                    <div
                      key={employee.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2",
                        index === 0 && "bg-brand-100"
                      )}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success text-xs font-semibold text-success-foreground">
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

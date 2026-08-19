"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import { AdminBubbleChart, type BubbleEntry } from "@/components/admin-bubble-chart";
import { Card, CardContent } from "@/components/ui/card";
import {
  MOCK_MONTHLY_ON_TIME,
  getActiveEmployees,
  getEmployeesOnLeave,
  getSimulatedRoster,
  getUpcomingHolidays,
  mockKioskDevices,
  mockWorkSchedules,
  type MockEmployee,
} from "@/lib/mock-data";
import {
  deriveFallbackCode,
  encodeKioskQrPayload,
  generateKioskQrPayload,
  KIOSK_QR_ROTATE_SECONDS,
  type KioskQrPayload,
} from "@/lib/kiosk-token";
import { formatThaiDateWithDay } from "@/lib/utils";

const ON_TIME_RING_SIZE = 80;
const ON_TIME_RING_RADIUS = 34;
const ON_TIME_RING_STROKE = 8;
const RECENT_CHECKIN_LIMIT = 6;

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

function relativeTimeTh(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  return `${hours} ชั่วโมงที่แล้ว`;
}

function KioskLobbyTvContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const device = useMemo(
    () => mockKioskDevices.find((d) => d.tokenHash === token && d.revokedAt === null) ?? null,
    [token]
  );

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotates every 15s independent of the once-a-second clock tick above, so
  // the QR/code don't visibly reset on every clock update.
  const [qrPayload, setQrPayload] = useState<KioskQrPayload | null>(null);
  useEffect(() => {
    if (!device) return;
    const rotate = () => setQrPayload(generateKioskQrPayload(device.id));
    rotate();
    const timer = setInterval(rotate, KIOSK_QR_ROTATE_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [device]);

  const employees = useMemo(() => getActiveEmployees(), []);
  const todayIso = toIsoDateLocal(now);

  const roster = useMemo(
    () => getSimulatedRoster(employees, mockWorkSchedules, now),
    [employees, now]
  );

  const checkedInEntries = roster.filter((r) => r.checkInAt !== null);
  const leaveTodayCount = getEmployeesOnLeave(todayIso).length;
  const nextHoliday = getUpcomingHolidays(todayIso)[0];
  const daysToHoliday = nextHoliday
    ? Math.round(
      (new Date(`${nextHoliday.date}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) /
      86_400_000
    )
    : null;

  const recentCheckins = checkedInEntries
    .filter((r): r is typeof r & { checkInAt: Date } => r.checkInAt !== null)
    .sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime())
    .slice(0, RECENT_CHECKIN_LIMIT);

  const bubbleEntries: BubbleEntry[] = roster
    .filter((r) => r.checkInAt !== null || r.scheduledStart < now)
    .map((r) => ({
      id: r.employee.id,
      initials: initials(r.employee),
      pictureUrl: r.employee.pictureUrl,
      status: r.checkInAt !== null && r.status === "present" ? ("checked-in" as const) : ("late" as const),
    }));

  const onTimeCircumference = 2 * Math.PI * ON_TIME_RING_RADIUS;
  const onTimeOffset = onTimeCircumference * (1 - MOCK_MONTHLY_ON_TIME.percent / 100);

  if (!device) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-white">
        <p className="text-lg font-bold">ไม่พบอุปกรณ์นี้ หรือถูกเพิกถอนแล้ว</p>
        <p className="text-sm text-white/60">ติดต่อผู้ดูแลระบบเพื่อออกลิงก์อุปกรณ์ใหม่</p>
      </main>
    );
  }

  const qrValue = qrPayload
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/check-in/confirm?payload=${encodeKioskQrPayload(qrPayload)}`
    : "";
  const fallbackCode = qrPayload ? deriveFallbackCode(qrPayload) : "------";

  return (
    <main className="flex flex-1 flex-col gap-5 p-6">
      <header className="relative shrink-0 overflow-hidden rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <div className="relative flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">{device.name}</h1>
            <p className="mt-1 text-sm text-white/80">{device.location}</p>
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
            <AdminBubbleChart entries={bubbleEntries} />
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="rounded-2xl border border-brand-600/10 bg-brand-100">
            <CardContent className="flex items-center gap-4 p-4">
              {/* p-4 is the QR's quiet zone — the white background must stay
                  clear of the tinted card so scanners can lock onto the code. */}
              <div className="flex size-32 shrink-0 items-center justify-center rounded-xl bg-white p-3">
                {qrValue && <QRCodeSVG value={qrValue} size={104} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-900">สแกนเพื่อบันทึกเวลาเข้างาน</p>
                <p className="mt-2 text-xs text-brand-900/70">สแกนไม่ได้? กรอกรหัส</p>
                <p className="text-lg font-bold tracking-widest text-brand-600 tabular-nums">{fallbackCode}</p>
              </div>
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
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${index === 0 ? "bg-brand-100" : ""}`}
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

export default function KioskLobbyTvPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center text-white">กำลังโหลด…</main>}>
      <KioskLobbyTvContent />
    </Suspense>
  );
}

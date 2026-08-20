"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import { Card, CardContent } from "@/components/ui/card";
import type { MockHoliday } from "@/lib/mock-data";
import { listHolidays } from "@/lib/api-holidays";
import { getKioskQrToken, getKioskRosterStats, type KioskQrToken, type KioskRosterStats } from "@/lib/api-kiosk";
import { formatThaiDateWithDay } from "@/lib/utils";

const QR_ROTATE_SECONDS = 15; // matches backend usecase.QRTokenTTL

// Cosmetic only — there's no backend endpoint to submit a typed-in fallback
// code, this is purely a stable-looking stand-in for scanners that fail. It
// was equally non-functional before this page was wired to the real QR
// token (nothing ever consumed it), so this just derives it from the real
// token string instead of the old mock payload.
function deriveFallbackCode(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  return String(Math.abs(h) % 1_000_000).padStart(6, "0");
}

const ON_TIME_RING_SIZE = 80;
const ON_TIME_RING_RADIUS = 34;
const ON_TIME_RING_STROKE = 8;

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function KioskLobbyTvContent() {
  const searchParams = useSearchParams();
  const deviceToken = searchParams.get("token");

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Rotates every 15s independent of the once-a-second clock tick above, so
  // the QR/code don't visibly reset on every clock update. Polls the real
  // backend (GET /kiosk/qr-token) rather than generating a payload locally
  // — the token is opaque and HMAC-signed server-side.
  const [qrToken, setQrToken] = useState<KioskQrToken | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  useEffect(() => {
    if (!deviceToken) return;
    let cancelled = false;
    const rotate = () => {
      getKioskQrToken(deviceToken)
        .then((next) => {
          if (!cancelled) {
            setQrToken(next);
            setQrError(null);
          }
        })
        .catch((err: Error) => {
          if (!cancelled) setQrError(err.message);
        });
    };
    rotate();
    const timer = setInterval(rotate, QR_ROTATE_SECONDS * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [deviceToken]);

  const [holidays, setHolidays] = useState<MockHoliday[]>([]);
  useEffect(() => {
    const now2 = new Date();
    const from = toIsoDateLocal(now2);
    const to = toIsoDateLocal(new Date(now2.getFullYear() + 1, now2.getMonth(), now2.getDate()));
    listHolidays(from, to)
      .then((rows) => setHolidays([...rows].sort((a, b) => a.date.localeCompare(b.date))))
      .catch(() => setHolidays([]));
  }, []);

  // GET /kiosk/roster-stats -- aggregate-only counts, no employee identity.
  // Polled on the same 15s cadence as the QR rotation; a public display
  // doesn't need sub-15s freshness here.
  const [stats, setStats] = useState<KioskRosterStats | null>(null);
  useEffect(() => {
    if (!deviceToken) return;
    let cancelled = false;
    const poll = () => {
      getKioskRosterStats(deviceToken)
        .then((next) => {
          if (!cancelled) setStats(next);
        })
        .catch(() => {
          // Best-effort: stats just stay at their last known value (or
          // blank) rather than blocking the QR/clock, which are this
          // page's primary job.
        });
    };
    poll();
    const timer = setInterval(poll, QR_ROTATE_SECONDS * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [deviceToken]);

  const todayIso = toIsoDateLocal(now);

  const nextHoliday = holidays.find((h) => h.date >= todayIso);
  const daysToHoliday = nextHoliday
    ? Math.round(
      (new Date(`${nextHoliday.date}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) /
      86_400_000
    )
    : null;

  // "On time today" (present minus late/absent, over everyone checked in)
  // -- not a monthly figure like the old mock's MOCK_MONTHLY_ON_TIME, since
  // /kiosk/roster-stats only aggregates today (see its backend doc comment
  // for why it stays narrowly scoped). Undefined (ring empty) until stats
  // load or before anyone's checked in yet.
  const onTimePercent =
    stats && stats.checkedIn > 0
      ? Math.round(((stats.checkedIn - stats.late - stats.absent) / stats.checkedIn) * 100)
      : null;
  const onTimeCircumference = 2 * Math.PI * ON_TIME_RING_RADIUS;
  const onTimeOffset = onTimeCircumference * (1 - (onTimePercent ?? 0) / 100);

  if (!deviceToken || qrError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-white">
        <p className="text-lg font-bold">ไม่พบอุปกรณ์นี้ หรือถูกเพิกถอนแล้ว</p>
        <p className="text-sm text-white/60">ติดต่อผู้ดูแลระบบเพื่อออกลิงก์อุปกรณ์ใหม่</p>
      </main>
    );
  }

  if (!qrToken) {
    return (
      <main className="flex flex-1 items-center justify-center text-white">กำลังโหลด…</main>
    );
  }

  const qrValue = `${typeof window !== "undefined" ? window.location.origin : ""}/check-in/confirm?token=${encodeURIComponent(qrToken.token)}`;
  const fallbackCode = deriveFallbackCode(qrToken.token);

  return (
    <main className="flex flex-1 flex-col gap-5 p-6">
      <header className="relative shrink-0 overflow-hidden rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <div className="relative flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">{qrToken.deviceName}</h1>
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
        <Card className="flex min-h-0 flex-col rounded-2xl border border-slate-200 ring-0 lg:col-span-2">
          <CardContent className="flex min-h-0 flex-1 flex-col justify-center gap-6 p-8">
            <div>
              <p className="text-sm font-semibold text-foreground">เข้างานวันนี้</p>
              <p className="mt-2 text-6xl font-bold tabular-nums text-brand-900">
                {stats ? stats.checkedIn : "–"}
                <span className="text-2xl font-medium text-muted-foreground"> / {stats ? stats.totalActive : "–"} คน</span>
              </p>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full bg-brand-600 transition-all duration-500"
                  style={{
                    width: stats && stats.totalActive > 0 ? `${Math.min(100, (stats.checkedIn / stats.totalActive) * 100)}%` : "0%",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">สาย</p>
                <p className="mt-1 text-2xl font-bold text-warning-foreground tabular-nums">
                  {stats ? stats.late : "–"}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">ขาด</p>
                <p className="mt-1 text-2xl font-bold text-danger-foreground tabular-nums">
                  {stats ? stats.absent : "–"}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">ลา</p>
                <p className="mt-1 text-2xl font-bold text-brand-600 tabular-nums">
                  {stats ? stats.onLeave : "–"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="rounded-2xl border border-brand-600/10 bg-brand-100 ring-0">
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

          <Card className="rounded-2xl border border-slate-200 ring-0">
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
                  {onTimePercent ?? "–"}%
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">ตรงเวลาวันนี้</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats ? stats.checkedIn : "–"} เช็คอิน
                </p>
              </div>
            </CardContent>
          </Card>

          {/* On-leave count already shown in the "ลา" tile of the main
              stat panel -- this card only adds the holiday countdown,
              which has no home elsewhere on the page. */}
          <Card className="rounded-2xl border border-slate-200 ring-0">
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

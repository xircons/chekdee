"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckInMessage } from "@/components/check-in-message";
import { CheckInSuccess } from "@/components/check-in-success";
import { useTodayAttendance } from "@/lib/attendance-store";
import { DESKTOP_INNER_FRAME, DESKTOP_OUTER_FRAME } from "@/lib/check-in-frame";
import { decodeKioskQrPayload, isKioskQrPayloadExpired } from "@/lib/kiosk-token";
import { mockKioskDevices } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ConfirmCheckInContent() {
  const searchParams = useSearchParams();
  const payloadParam = searchParams.get("payload");
  const { today, checkIn } = useTodayAttendance();
  const [confirmed, setConfirmed] = useState(false);

  const payload = useMemo(
    () => (payloadParam ? decodeKioskQrPayload(payloadParam) : null),
    [payloadParam]
  );

  const device = useMemo(
    () =>
      payload
        ? (mockKioskDevices.find((d) => d.id === payload.siteId && d.revokedAt === null) ?? null)
        : null,
    [payload]
  );

  if (confirmed) {
    return <CheckInSuccess />;
  }

  if (!payload || !device) {
    return <CheckInMessage message="ไม่พบข้อมูล QR นี้ หรืออุปกรณ์ถูกเพิกถอนแล้ว" />;
  }

  if (isKioskQrPayloadExpired(payload)) {
    return <CheckInMessage message="QR หมดอายุแล้ว กรุณาสแกนใหม่อีกครั้ง" />;
  }

  if (today.checkInAt !== null) {
    return <CheckInMessage message={`เช็คอินไปแล้ววันนี้ เมื่อ ${formatTime(today.checkInAt)}`} />;
  }

  const handleConfirm = () => {
    checkIn();
    setConfirmed(true);
  };

  return (
    <div className={DESKTOP_OUTER_FRAME}>
      <div className={cn("flex flex-col bg-white", DESKTOP_INNER_FRAME)}>
        <div className="rounded-b-3xl bg-brand-600 px-6 pt-10 pb-10 text-center text-white">
          <p className="text-sm text-white/80">ยืนยันการบันทึกเวลา</p>
          <h1 className="mt-1 text-2xl font-bold">{device.name}</h1>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-6 pt-6">
          <Card className="rounded-2xl border border-slate-200 ring-0">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <MapPin className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{device.location}</p>
                <p className="text-xs text-muted-foreground">ยืนยันเพื่อบันทึกเวลาเข้างาน</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-10 text-center">
          <Button
            onClick={handleConfirm}
            className="h-11 w-full rounded-full bg-accent-600 font-semibold text-white hover:bg-accent-700"
          >
            ยืนยันเข้างาน
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmCheckInPage() {
  return (
    <Suspense fallback={<div className={DESKTOP_OUTER_FRAME} />}>
      <ConfirmCheckInContent />
    </Suspense>
  );
}

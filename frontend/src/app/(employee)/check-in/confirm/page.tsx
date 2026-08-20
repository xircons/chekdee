"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckInMessage } from "@/components/check-in-message";
import { CheckInSuccess } from "@/components/check-in-success";
import { checkIn as submitCheckIn } from "@/lib/api-attendance";
import { useTodayAttendance } from "@/lib/attendance-store";
import { DESKTOP_INNER_FRAME, DESKTOP_OUTER_FRAME } from "@/lib/check-in-frame";
import { cn } from "@/lib/utils";

function ConfirmCheckInContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { today, checkIn } = useTodayAttendance();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullPageError, setFullPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (confirmed) {
    return <CheckInSuccess />;
  }

  if (!token) {
    return <CheckInMessage message="ไม่พบข้อมูล QR นี้ หรืออุปกรณ์ถูกเพิกถอนแล้ว" />;
  }

  if (fullPageError) {
    return <CheckInMessage message={fullPageError} />;
  }

  if (today.checkInAt !== null) {
    return <CheckInMessage message="เช็คอินไปแล้ววันนี้" />;
  }

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const record = await submitCheckIn(token);
      checkIn(record.check_in_at ?? undefined);
      setConfirmed(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "เช็คอินไม่สำเร็จ";
      // These reflect the QR itself or an already-recorded check-in, not a
      // transient failure — worth a full-page message like the old
      // pre-computed expiry/already-checked-in states, not just an inline
      // retry prompt.
      if (
        message.includes("หมดอายุ") ||
        message.includes("ถูกใช้ไปแล้ว") ||
        message.includes("เพิกถอนแล้ว") ||
        message.includes("เช็คอินไปแล้ว")
      ) {
        setFullPageError(message);
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={DESKTOP_OUTER_FRAME}>
      <div className={cn("flex flex-col bg-white", DESKTOP_INNER_FRAME)}>
        <div className="rounded-b-3xl bg-brand-600 px-6 pt-10 pb-10 text-center text-white">
          <p className="text-sm text-white/80">ยืนยันการบันทึกเวลา</p>
          <h1 className="mt-1 text-2xl font-bold">เช็คอินเข้างาน</h1>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-6 pt-6">
          <Card className="rounded-2xl border border-slate-200 ring-0">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <MapPin className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">ยืนยันเพื่อบันทึกเวลาเข้างาน</p>
              </div>
            </CardContent>
          </Card>

          {submitError && (
            <p className="rounded-md border border-danger bg-danger px-3 py-2 text-sm text-danger-foreground">
              {submitError}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-10 text-center">
          <Button
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className="h-11 w-full rounded-full bg-accent-600 font-semibold text-white hover:bg-accent-700"
          >
            {submitting ? "กำลังบันทึก..." : "ยืนยันเข้างาน"}
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

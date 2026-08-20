"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Zap, ZapOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CheckInMessage } from "@/components/check-in-message";
import { CheckInSuccess } from "@/components/check-in-success";
import { useTodayAttendance } from "@/lib/attendance-store";
import { DESKTOP_INNER_FRAME, DESKTOP_OUTER_FRAME } from "@/lib/check-in-frame";
import { cn } from "@/lib/utils";

type ScanState = "requesting" | "denied" | "scanning" | "success";

// Torch is a real but non-standard MediaTrack extension — not in the
// lib.dom.d.ts capability/constraint types yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

export default function ScanCheckInPage() {
  const router = useRouter();
  const { today, checkIn } = useTodayAttendance();
  const alreadyCheckedIn = today.checkInAt !== null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>("requesting");
  const [torchOn, setTorchOn] = useState(false);

  // setState only happens inside the promise callbacks here, never
  // synchronously — safe to call directly from the mount effect below.
  const requestCamera = () => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setState("scanning");
      })
      .catch(() => setState("denied"));
  };

  useEffect(() => {
    // Only check-in is QR-based (check-out is a plain button on the home
    // page) — if today's check-in is already recorded, this route has
    // nothing left to do, so skip the camera prompt entirely.
    if (alreadyCheckedIn) return;
    requestCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    setState("requesting");
    requestCamera();
  };

  useEffect(() => {
    if (state !== "scanning") return;
    // No QR-decoding library wired up yet (mock data only) — simulate a
    // detected code shortly after the camera feed starts.
    const timer = setTimeout(() => {
      setState("success");
      checkIn();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }, 2200);
    return () => clearTimeout(timer);
    // checkIn isn't memoized by the provider; only `state` should
    // re-trigger this one-shot timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities() as TorchCapabilities;
    if (!capabilities.torch) return;
    const next = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
    setTorchOn(next);
  };

  if (state === "success") {
    return <CheckInSuccess />;
  }

  if (alreadyCheckedIn) {
    return <CheckInMessage message="เช็คอินไปแล้ววันนี้" />;
  }

  return (
    <div className={DESKTOP_OUTER_FRAME}>
      <div className={cn("flex flex-col bg-white", DESKTOP_INNER_FRAME)}>
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {state !== "denied" && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 z-0 size-full object-cover"
            />
          )}

          <div className="relative z-10 flex items-center justify-between rounded-b-3xl bg-brand-600 px-6 pt-6 pb-10 text-white">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="ปิด"
              className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            <p className="text-sm font-semibold">สแกน QR เพื่อเข้างาน</p>
            <button
              type="button"
              onClick={toggleTorch}
              aria-label="ไฟฉาย"
              className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-white/10"
            >
              {torchOn ? <ZapOff className="size-5" /> : <Zap className="size-5" />}
            </button>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden">
            {state === "denied" ? (
              <div className="flex flex-col items-center gap-4 px-8 text-center">
                <p className="text-sm text-muted-foreground">
                  ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้องแล้วลองใหม่อีกครั้ง
                </p>
                <Button
                  onClick={retry}
                  className="rounded-full bg-accent-600 px-6 font-semibold text-white hover:bg-accent-700"
                >
                  ลองอีกครั้ง
                </Button>
              </div>
            ) : (
              <div className="relative size-[240px]">
                <span className="absolute top-0 left-0 size-12 rounded-tl-2xl border-t-4 border-l-4 border-white" />
                <span className="absolute top-0 right-0 size-12 rounded-tr-2xl border-t-4 border-r-4 border-white" />
                <span className="absolute bottom-0 left-0 size-12 rounded-bl-2xl border-b-4 border-l-4 border-white" />
                <span className="absolute right-0 bottom-0 size-12 rounded-br-2xl border-r-4 border-b-4 border-white" />
              </div>
            )}
          </div>
        </div>

        {state !== "denied" && (
          <div className="flex flex-col items-center gap-1 px-6 pt-4 pb-10 text-center">
            <p className="text-base font-bold text-foreground">วางกล้องให้ตรงกับ QR</p>
            <p className="text-sm text-muted-foreground">สแกนเพื่อบันทึกเวลาเข้างานอัตโนมัติ</p>
          </div>
        )}
      </div>
    </div>
  );
}

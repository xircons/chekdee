"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Zap, ZapOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTodayAttendance } from "@/lib/attendance-store";
import { cn } from "@/lib/utils";

type ScanState = "requesting" | "denied" | "scanning" | "success";

// Torch is a real but non-standard MediaTrack extension — not in the
// lib.dom.d.ts capability/constraint types yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

// Shared with the main scanning screen below — keeps both states framed
// identically as a centered phone-width card on desktop.
const DESKTOP_FRAME =
  "md:inset-y-8 md:right-auto md:left-1/2 md:w-[520px] md:-translate-x-1/2 md:overflow-hidden md:rounded-3xl md:shadow-xl";

export default function ScanCheckInPage() {
  const router = useRouter();
  const { today, checkIn, checkOut } = useTodayAttendance();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>("requesting");
  const [torchOn, setTorchOn] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [countdown, setCountdown] = useState(5);

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
    requestCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
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
      if (today.checkInAt) {
        checkOut();
      } else {
        checkIn();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }, 2200);
    return () => clearTimeout(timer);
    // checkIn/checkOut aren't memoized by the provider and router is stable;
    // only `state` should re-trigger this one-shot timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (state !== "success") return;
    // Matches the dot-grow animation's duration — the check mark and text
    // reveal right as the circle finishes popping in, not after a pause.
    const revealTimer = setTimeout(() => setShowCheck(true), 400);
    return () => clearTimeout(revealTimer);
  }, [state]);

  // Ticks the redirect countdown once the check mark is revealed; hits 0 and navigates home.
  useEffect(() => {
    if (!showCheck) return;
    if (countdown <= 0) {
      router.push("/");
      return;
    }
    const tick = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(tick);
  }, [showCheck, countdown, router]);

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
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white px-8 text-center",
          DESKTOP_FRAME
        )}
      >
        {/* Sized and positioned once, up front — the reveal blocks below reserve
            their space from the start so this circle never has to re-center. */}
        <div className="flex size-24 items-center justify-center rounded-full bg-success-foreground animate-dot-grow">
          {showCheck && (
            <Check className="size-12 animate-in text-white zoom-in-50 duration-150" strokeWidth={3} />
          )}
        </div>

        {/* Each line reveals in priority order — the confirmation itself first,
            supporting detail next, exit action last — fading + settling in
            place rather than fading the whole block at once. */}
        <div className="flex flex-col items-center gap-1">
          <p
            className={cn(
              "text-xl font-bold text-brand-900",
              showCheck
                ? "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300"
                : "invisible",
            )}
          >
            บันทึกเวลาสำเร็จ
          </p>
          <p
            className={cn(
              "text-sm text-muted-foreground",
              showCheck
                ? "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both delay-100 duration-300"
                : "invisible",
            )}
          >
            ระบบบันทึกเวลาเข้างานของคุณเรียบร้อยแล้ว
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={() => router.push("/")}
            className={cn(
              "rounded-full bg-brand-600 px-8 font-semibold text-white hover:bg-brand-900",
              showCheck
                ? "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both delay-200 duration-300"
                : "invisible",
            )}
          >
            กลับหน้าหลัก
          </Button>
          <p
            className={cn(
              "text-xs text-muted-foreground",
              showCheck
                ? "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both delay-300 duration-300"
                : "invisible",
            )}
          >
            กำลังกลับไปหน้าหลักใน {countdown} วินาที
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("fixed inset-0 z-50 flex flex-col bg-white", DESKTOP_FRAME)}>
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
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
          <p className="text-sm font-semibold">สแกน QR เพื่อเข้างาน</p>
          <button
            type="button"
            onClick={toggleTorch}
            aria-label="ไฟฉาย"
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"
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
  );
}

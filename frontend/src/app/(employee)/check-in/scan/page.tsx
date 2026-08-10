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

export default function ScanCheckInPage() {
  const router = useRouter();
  const { today, checkIn, checkOut } = useTodayAttendance();
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
      setTimeout(() => router.push("/"), 700);
    }, 2200);
    return () => clearTimeout(timer);
    // checkIn/checkOut aren't memoized by the provider and router is stable;
    // only `state` should re-trigger this one-shot timer.
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black md:inset-y-8 md:right-auto md:left-1/2 md:w-[520px] md:-translate-x-1/2 md:overflow-hidden md:rounded-3xl md:shadow-xl">
      <div className="flex items-center justify-between bg-brand-900 px-4 py-4 text-white">
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

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {state !== "denied" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 size-full object-cover"
          />
        )}

        {state === "denied" ? (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <p className="text-sm text-white/80">
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
          <div className="relative size-[170px]">
            <span className="absolute top-0 left-0 size-8 rounded-tl-2xl border-t-4 border-l-4 border-accent-600" />
            <span className="absolute top-0 right-0 size-8 rounded-tr-2xl border-t-4 border-r-4 border-accent-600" />
            <span className="absolute bottom-0 left-0 size-8 rounded-bl-2xl border-b-4 border-l-4 border-accent-600" />
            <span className="absolute right-0 bottom-0 size-8 rounded-br-2xl border-r-4 border-b-4 border-accent-600" />

            {state === "success" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-success">
                  <Check className="size-7 text-success-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {state !== "denied" && (
        <div className="flex flex-col items-center gap-1 px-6 pt-4 pb-10 text-center">
          <p className={cn("text-base font-bold text-white", state === "success" && "text-success")}>
            {state === "success" ? "บันทึกเวลาสำเร็จ" : "วางกล้องให้ตรงกับ QR"}
          </p>
          <p className="text-sm text-white/60">สแกนเพื่อบันทึกเวลาเข้างานอัตโนมัติ</p>
        </div>
      )}
    </div>
  );
}

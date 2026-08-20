"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DESKTOP_INNER_FRAME, DESKTOP_OUTER_FRAME } from "@/lib/check-in-frame";
import { cn } from "@/lib/utils";

const REDIRECT_SECONDS = 5;

export function CheckInSuccess() {
  const router = useRouter();
  const [showCheck, setShowCheck] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    // Matches the dot-grow animation's duration — the check mark and text
    // reveal right as the circle finishes popping in, not after a pause.
    const revealTimer = setTimeout(() => setShowCheck(true), 400);
    return () => clearTimeout(revealTimer);
  }, []);

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

  return (
    <div className={DESKTOP_OUTER_FRAME}>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-5 bg-white px-8 text-center",
          DESKTOP_INNER_FRAME
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
    </div>
  );
}

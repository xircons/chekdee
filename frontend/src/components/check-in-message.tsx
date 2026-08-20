"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DESKTOP_INNER_FRAME, DESKTOP_OUTER_FRAME } from "@/lib/check-in-frame";
import { cn } from "@/lib/utils";

export function CheckInMessage({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div className={DESKTOP_OUTER_FRAME}>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-5 bg-white px-8 text-center",
          DESKTOP_INNER_FRAME
        )}
      >
        <p className="text-base font-semibold text-foreground">{message}</p>
        <Button
          onClick={() => router.push("/")}
          className="rounded-full bg-brand-600 px-8 font-semibold text-white hover:bg-brand-900"
        >
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  );
}

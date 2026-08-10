"use client";

import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ScheduleDayModalBadgeTone = "brand" | "warning" | "muted";

const BADGE_VARIANT: Record<ScheduleDayModalBadgeTone, "default" | "warning" | "secondary"> = {
  brand: "default",
  warning: "warning",
  muted: "secondary",
};

export function ScheduleDayModal({
  open,
  onOpenChange,
  icon: Icon,
  dateLabel,
  badgeText,
  badgeTone = "brand",
  infoLabel,
  infoValue,
  infoValueSize = "lg",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  dateLabel: string;
  badgeText: string;
  badgeTone?: ScheduleDayModalBadgeTone;
  infoLabel: string;
  infoValue: string;
  infoValueSize?: "lg" | "sm";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs gap-4">
        <DialogHeader className="flex-row items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-col items-start gap-1">
            <DialogTitle className="text-base font-bold">{dateLabel}</DialogTitle>
            <Badge
              variant={BADGE_VARIANT[badgeTone]}
              className={cn(badgeTone === "brand" && "bg-brand-600 text-white")}
            >
              {badgeText}
            </Badge>
          </div>
        </DialogHeader>

        <div className="border-t border-border" />

        <div className="rounded-xl bg-slate-50 px-4 py-3.5">
          <p className="text-xs text-muted-foreground">{infoLabel}</p>
          <p
            className={cn(
              "font-semibold text-brand-600",
              infoValueSize === "lg" ? "text-2xl tabular-nums" : "text-base"
            )}
          >
            {infoValue}
          </p>
        </div>

        <Button
          className="h-11 w-full rounded-full bg-accent-600 font-semibold text-white hover:bg-accent-700"
          onClick={() => onOpenChange(false)}
        >
          ตกลง
        </Button>
      </DialogContent>
    </Dialog>
  );
}

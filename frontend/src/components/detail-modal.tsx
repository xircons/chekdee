"use client";

import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type DetailModalBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Shared "tap something, see a clean detail card" shell — icon + title +
// badge in the header, a divider, then whatever info blocks the caller
// needs, and an optional footer (e.g. a close CTA). Used by the schedule
// calendar's day preview and the leave request list's row preview.
export function DetailModal({
  open,
  onOpenChange,
  icon: Icon,
  title,
  badgeText,
  badgeVariant = "default",
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  badgeText: string;
  badgeVariant?: DetailModalBadgeVariant;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs gap-4">
        <DialogHeader className="flex-row items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-col items-start gap-1">
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            <Badge
              variant={badgeVariant}
              className={cn(badgeVariant === "default" && "bg-brand-600 text-white")}
            >
              {badgeText}
            </Badge>
          </div>
        </DialogHeader>

        <div className="border-t border-border" />

        {children}

        {footer}
      </DialogContent>
    </Dialog>
  );
}

export function DetailModalInfoBlock({
  label,
  value,
  valueSize = "lg",
}: {
  label: string;
  value: string;
  valueSize?: "lg" | "sm";
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold text-brand-600",
          valueSize === "lg" ? "text-2xl tabular-nums" : "text-base"
        )}
      >
        {value}
      </p>
    </div>
  );
}

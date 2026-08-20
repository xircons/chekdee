"use client";

import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { DetailModalInfoBlock } from "@/components/detail-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Re-exported so callers only need one import for both the dialog shell
// and its info-block content — it's the same portable component the
// employee shell's DetailModal uses (no mobile-sheet coupling).
export { DetailModalInfoBlock as AdminDetailInfoBlock };

export type AdminDetailDialogBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Desktop equivalent of the employee shell's DetailModal — same visual
// recipe (icon in a brand-100 tile, title + filled badge, divider, info
// blocks, optional footer), built on ui/dialog.tsx instead of the mobile
// bottom-sheet primitive, since a sheet sliding up from the bottom would
// look wrong in a desktop admin panel.
export function AdminDetailDialog({
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
  badgeVariant?: AdminDetailDialogBadgeVariant;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl p-5">
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

        <div className="border-t border-slate-200" />

        {children}

        {footer}
      </DialogContent>
    </Dialog>
  );
}

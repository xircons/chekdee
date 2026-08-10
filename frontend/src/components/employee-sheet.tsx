"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Bottom-sheet popup for the employee shell — mirrors ui/dialog.tsx's
// structure but slides up from the bottom instead of zooming in centered,
// and never fades its panel (only the backdrop dims). Kept separate from
// ui/dialog.tsx because that one is shared with the desktop admin panel,
// where a bottom sheet would look wrong.

function EmployeeSheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="employee-sheet" {...props} />;
}

function EmployeeSheetPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="employee-sheet-portal" {...props} />;
}

function EmployeeSheetOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="employee-sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

// "bottom" (default) is a full-width sheet for content-heavy popups (email
// preview, request detail). "center" is a small card that rises and settles
// in place — for a single quick fact (e.g. the calendar day popup), a
// bottom sheet leaves a lot of dead space and pulls the eye all the way
// down; a compact centered card reads better at that size while still
// keeping the "slide, don't fade" motion.
function EmployeeSheetContent({
  className,
  children,
  showCloseButton = true,
  position = "bottom",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  position?: "bottom" | "center";
}) {
  return (
    <EmployeeSheetPortal>
      <EmployeeSheetOverlay />
      <DialogPrimitive.Popup
        data-slot="employee-sheet-content"
        className={cn(
          position === "bottom"
            ? "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl p-5 pb-6 duration-200 data-open:animate-in data-open:slide-in-from-bottom-8 data-closed:animate-out data-closed:slide-out-to-bottom-8"
            : "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-3xl p-5 duration-200 data-open:animate-in data-open:slide-in-from-bottom-4 data-open:zoom-in-95 data-closed:animate-out data-closed:slide-out-to-bottom-4 data-closed:zoom-out-95",
          "bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="employee-sheet-close"
            render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </EmployeeSheetPortal>
  );
}

function EmployeeSheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="employee-sheet-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function EmployeeSheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="employee-sheet-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

export {
  EmployeeSheet,
  EmployeeSheetContent,
  EmployeeSheetHeader,
  EmployeeSheetTitle,
};

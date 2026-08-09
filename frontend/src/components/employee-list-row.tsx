import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmployeeListRow({
  icon: Icon,
  label,
  sublabel,
  value,
  trailing,
  accent,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  sublabel?: string;
  value?: string;
  trailing?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border py-3 last:border-b-0",
        accent && "-ml-(--card-spacing) border-l-2 border-l-accent-600 pl-[calc(var(--card-spacing)-2px)]",
        className
      )}
    >
      {Icon && (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Icon className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium text-foreground", accent && "text-brand-600")}>{label}</p>
        {sublabel && <p className="truncate text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      {value && <p className="shrink-0 text-sm text-muted-foreground">{value}</p>}
      {trailing}
    </div>
  );
}

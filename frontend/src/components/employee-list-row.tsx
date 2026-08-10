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
  onClick,
}: {
  icon?: LucideIcon;
  label: string;
  sublabel?: string;
  value?: string;
  trailing?: ReactNode;
  accent?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const rowClassName = cn(
    "flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-b-0",
    onClick && "transition-[transform,background-color] hover:bg-muted/40 active:scale-[0.98] active:bg-muted/60",
    accent && "-ml-(--card-spacing) border-l-2 border-l-accent-600 pl-[calc(var(--card-spacing)-2px)]",
    className
  );

  const content = (
    <>
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
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClassName}>
        {content}
      </button>
    );
  }

  return <div className={rowClassName}>{content}</div>;
}

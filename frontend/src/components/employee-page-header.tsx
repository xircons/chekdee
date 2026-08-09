import { Bell } from "lucide-react";

export function EmployeePageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="rounded-b-3xl bg-brand-600 px-6 pt-6 pb-10 text-white">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Bell className="size-4 text-white/90" aria-hidden />
        </div>
      </div>
      {subtitle && <p className="mt-2 text-sm text-white/80">{subtitle}</p>}
    </header>
  );
}

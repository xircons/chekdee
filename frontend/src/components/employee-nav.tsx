"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, FileText, House, User } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "หน้าแรก", icon: House },
  { href: "/leave", label: "ขอลา", icon: FileText },
  { href: "/schedule", label: "ตารางงาน", icon: Calendar },
  { href: "/profile", label: "โปรไฟล์", icon: User },
];

export function EmployeeNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.href === pathname)
  );

  return (
    <nav className="sticky bottom-0 z-10 flex rounded-t-2xl bg-card px-2 py-2 shadow-[0_-6px_16px_rgba(15,42,92,0.07)]">
      <div
        className="absolute inset-y-2 left-2 rounded-lg bg-brand-600 transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 1rem) / ${tabs.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
        aria-hidden
      />
      {tabs.map((tab, index) => {
        const active = index === activeIndex;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative z-10 flex flex-1 flex-col items-center gap-1 py-2 text-xs text-current transition-colors active:scale-95",
              active ? "font-semibold text-white" : "font-medium text-muted-foreground"
            )}
          >
            <Icon className="size-5 text-current" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

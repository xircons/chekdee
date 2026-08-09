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

  return (
    <nav className="sticky bottom-0 z-10 flex gap-1 border-t border-border bg-card px-2 py-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-xs font-medium text-current transition-colors",
              active ? "bg-brand-100 text-brand-600" : "text-muted-foreground"
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

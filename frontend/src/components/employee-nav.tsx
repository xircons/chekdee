"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, FileText, House, User } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: House },
  { href: "/leave", label: "Leave", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/profile", label: "Profile", icon: User },
];

export function EmployeeNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-border bg-card">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

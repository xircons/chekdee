"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PartyPopper,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { logout } from "@/lib/session";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/admin/holidays", label: "Holidays", icon: PartyPopper },
  { href: "/admin/leave-requests", label: "Leave requests", icon: ClipboardList },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-4 py-5">
        <p className="text-lg font-bold text-foreground">Checkdee</p>
        <p className="text-xs text-muted-foreground">Admin panel</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {links.map((link) => {
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => {
          void logout().then(() => router.push("/login"));
        }}
        className="mx-2 mb-4 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-4" />
        Log out
      </button>
    </aside>
  );
}

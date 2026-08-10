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
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-card">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
          C
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Checkdee</p>
          <p className="text-xs text-muted-foreground">Admin panel</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {links.map((link) => {
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-brand-100 font-semibold text-brand-600"
                  : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
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
        className="mx-3 mb-4 flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-4" />
        Log out
      </button>
    </aside>
  );
}

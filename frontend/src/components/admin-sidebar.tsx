"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  PartyPopper,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/session";

const links = [
  { href: "/admin", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/admin/employees", label: "พนักงาน", icon: Users },
  { href: "/admin/schedules", label: "ตารางงาน", icon: CalendarClock },
  { href: "/admin/holidays", label: "วันหยุด", icon: PartyPopper },
  { href: "/admin/leave-requests", label: "คำขอลา", icon: ClipboardList },
  { href: "/admin/devices", label: "อุปกรณ์", icon: MonitorSmartphone },
  { href: "/admin/reports", label: "รายงาน", icon: FileBarChart2 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    // The row-flex parent (admin/layout.tsx) is pinned to h-screen and never
    // scrolls, so a plain h-screen here lines up exactly — no sticky needed.
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-card">
      <div className="px-3 pt-4 pb-3">
        <Card className="rounded-2xl py-0">
          <CardContent className="flex items-center gap-2.5 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-600">
              C
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Checkdee</p>
              <Badge variant="secondary" className="mt-1">
                ผู้ดูแลระบบ
              </Badge>
            </div>
          </CardContent>
        </Card>
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

      <Button
        variant="outline"
        className="mx-3 mb-4 h-11 gap-2 rounded-lg"
        onClick={() => {
          void logout().then(() => router.push("/login"));
        }}
      >
        <LogOut className="size-4" />
        ออกจากระบบ
      </Button>
    </aside>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  getAttendanceForDate,
  getEmployeesOnLeave,
  getPendingLeaveRequests,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";

export default function AdminDashboard() {
  const me = useMe();

  const today = new Date().toISOString().slice(0, 10);
  const todaysAttendance = getAttendanceForDate(today);

  const stats = [
    {
      label: "Present today",
      value: todaysAttendance.filter((r) => r.status === "present" || r.status === "สาย").length,
    },
    { label: "Pending approvals", value: getPendingLeaveRequests().length },
    { label: "Absent today", value: todaysAttendance.filter((r) => r.status === "ขาด").length },
    { label: "On leave today", value: getEmployeesOnLeave(today).length },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">
        Welcome, {me.first_name ?? me.display_name}
      </h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

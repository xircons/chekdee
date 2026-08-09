"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTodayAttendance } from "@/lib/attendance-store";
import { getLeaveBalance, getMonthlyAttendanceStats } from "@/lib/mock-data";
import { useMe } from "@/lib/session";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function EmployeeHome() {
  const me = useMe();
  const router = useRouter();
  const { today } = useTodayAttendance();

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthly = getMonthlyAttendanceStats(me.id, yearMonth);
  const leaveBalance = getLeaveBalance(me.id, now.getFullYear());

  const stats = [
    { label: "Hours this month", value: String(monthly.hours) },
    { label: "Late (สาย)", value: String(monthly.lateCount) },
    { label: "Absent (ขาด)", value: String(monthly.absentCount) },
    { label: "Leave balance", value: String(leaveBalance) },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome, {me.first_name ?? me.display_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Employee attendance for CAMT, Chiang Mai University
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            {!today.checkInAt && (
              <>
                <p className="text-sm font-medium text-foreground">Not checked in</p>
                <Badge variant="warning" className="mt-1">
                  Pending
                </Badge>
              </>
            )}
            {today.checkInAt && !today.checkOutAt && (
              <>
                <p className="text-sm font-medium text-foreground">
                  Checked in at {formatTime(today.checkInAt)}
                </p>
                <Badge variant="success" className="mt-1">
                  Present
                </Badge>
              </>
            )}
            {today.checkInAt && today.checkOutAt && (
              <>
                <p className="text-sm font-medium text-foreground">
                  Checked out at {formatTime(today.checkOutAt)}
                </p>
                <Badge variant="success" className="mt-1">
                  Done for today
                </Badge>
              </>
            )}
          </div>
          <Button onClick={() => router.push("/check-in")}>
            {today.checkInAt && !today.checkOutAt ? "Check Out" : "Check In"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
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

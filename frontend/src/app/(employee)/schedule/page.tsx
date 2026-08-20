"use client";

import { useEffect, useState } from "react";

import { EmployeeListRow } from "@/components/employee-list-row";
import { EmployeePageHeader } from "@/components/employee-page-header";
import { EmployeeScheduleCalendar } from "@/components/employee-schedule-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listHolidays } from "@/lib/api-holidays";
import type { MockHoliday } from "@/lib/mock-data";

function formatHolidayDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function SchedulePage() {
  const [holidays, setHolidays] = useState<MockHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const from = toIsoDateLocal(now);
    const to = toIsoDateLocal(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()));
    listHolidays(from, to)
      .then((rows) => setHolidays([...rows].sort((a, b) => a.date.localeCompare(b.date))))
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader
        title="ตารางงาน"
        subtitle="ตารางเวลาทำงานประจำสัปดาห์และวันหยุดที่จะถึง"
      />

      <div className="flex flex-col gap-6 px-6 py-6">
        <Card className="rounded-2xl border border-slate-200 ring-0">
          <CardHeader>
            <CardTitle>ตารางเวลาทำงานประจำสัปดาห์</CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeScheduleCalendar />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 ring-0">
          <CardHeader>
            <CardTitle>วันหยุดที่จะถึง</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {loading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
            {!loading && loadError && (
              <p className="text-sm text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
            )}
            {!loading && !loadError && holidays.length === 0 && (
              <p className="text-sm text-muted-foreground">ไม่มีวันหยุดที่จะถึง</p>
            )}
            {!loading && !loadError && holidays.map((holiday) => (
              <EmployeeListRow
                key={holiday.id}
                label={holiday.name}
                sublabel={holiday.localName ?? undefined}
                value={formatHolidayDate(holiday.date)}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

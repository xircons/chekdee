"use client";

import { EmployeeListRow } from "@/components/employee-list-row";
import { EmployeePageHeader } from "@/components/employee-page-header";
import { EmployeeScheduleCalendar } from "@/components/employee-schedule-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUpcomingHolidays } from "@/lib/mock-data";
import { useMe } from "@/lib/session";

function formatHolidayDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export default function SchedulePage() {
  const me = useMe();

  const today = new Date();
  const holidays = getUpcomingHolidays(today.toISOString().slice(0, 10));

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader
        title="ตารางงาน"
        subtitle="ตารางเวลาทำงานประจำสัปดาห์และวันหยุดที่จะถึง"
      />

      <div className="flex flex-col gap-6 px-6 py-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>ตารางเวลาทำงานประจำสัปดาห์</CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeScheduleCalendar employeeId={me.id} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>วันหยุดที่จะถึง</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {holidays.length === 0 && (
              <p className="text-sm text-muted-foreground">ไม่มีวันหยุดที่จะถึง</p>
            )}
            {holidays.map((holiday) => (
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

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUpcomingHolidays, getWorkScheduleForEmployee } from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatHolidayDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export default function SchedulePage() {
  const me = useMe();
  const schedule = getWorkScheduleForEmployee(me.id);

  const today = new Date();
  const holidays = getUpcomingHolidays(today.toISOString().slice(0, 10));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Schedule</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {DAY_LABELS.map((label, dayOfWeek) => {
            const entry = schedule.find((s) => s.dayOfWeek === dayOfWeek);
            const isToday = dayOfWeek === today.getDay();

            return (
              <div
                key={label}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2",
                  isToday && "bg-muted"
                )}
              >
                <p className="text-sm font-medium text-foreground">{label}</p>
                {entry ? (
                  <p className="text-sm text-muted-foreground">
                    {entry.startTime} – {entry.endTime}
                  </p>
                ) : (
                  <Badge variant="secondary">Off</Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Upcoming holidays</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {holidays.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
          )}
          {holidays.map((holiday) => (
            <div key={holiday.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{holiday.name}</p>
                {holiday.localName && (
                  <p className="text-xs text-muted-foreground">{holiday.localName}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatHolidayDate(holiday.date)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

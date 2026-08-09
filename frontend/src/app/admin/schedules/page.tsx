"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getActiveEmployees, mockWorkSchedules, type MockWorkSchedule } from "@/lib/mock-data";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type DayEntry = { working: boolean; startTime: string; endTime: string };

function buildDayEntries(employeeId: string, schedules: MockWorkSchedule[]): DayEntry[] {
  return DAY_LABELS.map((_, dayOfWeek) => {
    const entry = schedules.find((s) => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek);
    return entry
      ? { working: true, startTime: entry.startTime, endTime: entry.endTime }
      : { working: false, startTime: "09:00", endTime: "17:00" };
  });
}

function ScheduleEditor({
  employeeId,
  schedules,
  onSave,
}: {
  employeeId: string;
  schedules: MockWorkSchedule[];
  onSave: (employeeId: string, days: DayEntry[]) => void;
}) {
  const [days, setDays] = useState<DayEntry[]>(() => buildDayEntries(employeeId, schedules));
  const [saved, setSaved] = useState(false);

  const updateDay = (index: number, patch: Partial<DayEntry>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSaved(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
          >
            <Switch
              checked={days[i].working}
              onCheckedChange={(checked) => updateDay(i, { working: checked })}
            />
            <p className="w-24 text-sm font-medium text-foreground">{label}</p>
            {days[i].working ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={days[i].startTime}
                  onChange={(e) => updateDay(i, { startTime: e.target.value })}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={days[i].endTime}
                  onChange={(e) => updateDay(i, { endTime: e.target.value })}
                  className="w-32"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Off</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => {
            onSave(employeeId, days);
            setSaved(true);
          }}
          className="self-start"
        >
          Save schedule
        </Button>
        {saved && <p className="text-xs text-muted-foreground">Saved.</p>}
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const employees = getActiveEmployees().filter((e) => e.role === "employee");
  const [selectedId, setSelectedId] = useState<string | null>(employees[0]?.id ?? null);
  const [schedules, setSchedules] = useState<MockWorkSchedule[]>(mockWorkSchedules);

  const handleSave = (employeeId: string, days: DayEntry[]) => {
    setSchedules((prev) => {
      const withoutEmployee = prev.filter((s) => s.employeeId !== employeeId);
      const newEntries: MockWorkSchedule[] = days.flatMap((d, dayOfWeek) =>
        d.working
          ? [
              {
                id: `sched-${employeeId}-${dayOfWeek}`,
                employeeId,
                dayOfWeek,
                startTime: d.startTime,
                endTime: d.endTime,
                effectiveFrom: new Date().toISOString().slice(0, 10),
                effectiveTo: null,
              },
            ]
          : []
      );
      return [...withoutEmployee, ...newEntries];
    });
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Schedules</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Weekly schedule editor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee">Employee</Label>
            <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
              <SelectTrigger id="employee" className="w-64">
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedId && (
            <ScheduleEditor
              key={selectedId}
              employeeId={selectedId}
              schedules={schedules}
              onSave={handleSave}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

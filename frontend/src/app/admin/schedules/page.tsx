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

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

type DayEntry = { working: boolean; startTime: string; endTime: string };

type ImportRow = { employeeId: string; dayOfWeek: number; startTime: string; endTime: string };
type ImportError = { line: number; message: string };
type ImportResult = { imported: number; errors: ImportError[] };

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function validateRow(cells: string[], validEmployeeIds: Set<string>): { row?: ImportRow; error?: string } {
  const [employeeId, dayOfWeekRaw, startTime, endTime] = cells;

  if (!employeeId || !validEmployeeIds.has(employeeId)) {
    return { error: `unknown employee_id "${employeeId ?? ""}"` };
  }

  const dayOfWeek = Number(dayOfWeekRaw);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: `day_of_week must be 0–6, got "${dayOfWeekRaw ?? ""}"` };
  }

  if (!TIME_RE.test(startTime ?? "") || !TIME_RE.test(endTime ?? "")) {
    return { error: "start_time/end_time must be HH:mm" };
  }

  if (endTime <= startTime) {
    return { error: "end_time must be after start_time" };
  }

  return { row: { employeeId, dayOfWeek, startTime, endTime } };
}

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
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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
    setScheduleVersion((v) => v + 1);
  };

  const handleImport = async () => {
    if (!importFile) return;

    const text = await importFile.text();
    const rows = parseCsv(text);
    const hasHeader = rows[0]?.[0]?.toLowerCase() === "employee_id";
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const validEmployeeIds = new Set(employees.map((e) => e.id));

    const errors: ImportError[] = [];
    const validRows: ImportRow[] = [];

    dataRows.forEach((cells, i) => {
      const line = i + (hasHeader ? 2 : 1);
      const { row, error } = validateRow(cells, validEmployeeIds);
      if (error) {
        errors.push({ line, message: error });
      } else if (row) {
        validRows.push(row);
      }
    });

    setSchedules((prev) => {
      let next = prev;
      for (const row of validRows) {
        next = next.filter((s) => !(s.employeeId === row.employeeId && s.dayOfWeek === row.dayOfWeek));
      }
      const newEntries: MockWorkSchedule[] = validRows.map((row) => ({
        id: `sched-${row.employeeId}-${row.dayOfWeek}`,
        employeeId: row.employeeId,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: null,
      }));
      return [...next, ...newEntries];
    });

    setImportResult({ imported: validRows.length, errors });
    setScheduleVersion((v) => v + 1);
    setImportFile(null);
  };

  const handleDownloadTemplate = () => {
    const header = "employee_id,day_of_week,start_time,end_time";
    const example = `${employees[0]?.id ?? "user-1"},1,09:00,17:00`;
    const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Schedules</h1>

      <Card className="rounded-2xl">
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
              key={`${selectedId}-${scheduleVersion}`}
              employeeId={selectedId}
              schedules={schedules}
              onSave={handleSave}
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Bulk import (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Columns: <code>employee_id, day_of_week</code> (0–6, 0=Sunday),{" "}
            <code>start_time, end_time</code> (HH:mm). Existing entries for the same
            employee and day are replaced.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="w-auto"
            />
            <Button onClick={() => void handleImport()} disabled={!importFile}>
              Import
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              Download template
            </Button>
          </div>

          {importResult && (
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm">
              <p className="font-medium text-foreground">
                Imported {importResult.imported} row{importResult.imported === 1 ? "" : "s"}.
              </p>
              {importResult.errors.length > 0 && (
                <ul className="flex flex-col gap-1 text-danger-foreground">
                  {importResult.errors.map((e) => (
                    <li key={e.line}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, Copy, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getActiveEmployees,
  mockWorkSchedules,
  type MockEmployee,
  type MockWorkSchedule,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const DAY_LABELS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const WEEKDAY_COPY_TARGETS = [2, 3, 4, 5]; // Tuesday–Friday, filled from Monday (index 1)
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const FIELD_CLASS =
  "h-9 rounded-lg border-border bg-muted/40 px-4 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20";
const ACTION_BUTTON_CLASS = "h-9 rounded-lg px-5 text-sm";

type DayEntry = { working: boolean; startTime: string; endTime: string };
type Tab = "individual" | "import";

type ImportRow = { employeeId: string; dayOfWeek: number; startTime: string; endTime: string };
type ImportError = { line: number; message: string };
type ImportResult = { imported: number; errors: ImportError[] };

function employeeName(employee: MockEmployee): string {
  return `${employee.firstName} ${employee.lastName}`;
}

function initials(employee: MockEmployee): string {
  return `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();
}

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
    return { error: `ไม่พบรหัสพนักงาน "${employeeId ?? ""}"` };
  }

  const dayOfWeek = Number(dayOfWeekRaw);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: `day_of_week ต้องเป็น 0-6 แต่ได้ "${dayOfWeekRaw ?? ""}"` };
  }

  if (!TIME_RE.test(startTime ?? "") || !TIME_RE.test(endTime ?? "")) {
    return { error: "start_time/end_time ต้องอยู่ในรูปแบบ HH:mm" };
  }

  if (endTime <= startTime) {
    return { error: "end_time ต้องอยู่หลัง start_time" };
  }

  return { row: { employeeId, dayOfWeek, startTime, endTime } };
}

function buildDayEntries(employeeId: string, schedules: MockWorkSchedule[]): DayEntry[] {
  return DAY_LABELS_TH.map((_, dayOfWeek) => {
    const entry = schedules.find((s) => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek);
    return entry
      ? { working: true, startTime: entry.startTime, endTime: entry.endTime }
      : { working: false, startTime: "09:00", endTime: "17:00" };
  });
}

function ScheduleEditor({
  employee,
  schedules,
  onSave,
}: {
  employee: MockEmployee;
  schedules: MockWorkSchedule[];
  onSave: (employeeId: string, days: DayEntry[]) => void;
}) {
  const [days, setDays] = useState<DayEntry[]>(() => buildDayEntries(employee.id, schedules));
  const [saved, setSaved] = useState(false);

  const updateDay = (index: number, patch: Partial<DayEntry>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSaved(false);
  };

  const copyMondayToWeek = () => {
    setDays((prev) => {
      const monday = prev[1];
      return prev.map((d, i) =>
        WEEKDAY_COPY_TARGETS.includes(i)
          ? { working: true, startTime: monday.startTime, endTime: monday.endTime }
          : d
      );
    });
    setSaved(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">ตารางของ {employeeName(employee)}</p>
        <Button variant="outline" className={ACTION_BUTTON_CLASS} onClick={copyMondayToWeek}>
          <Copy className="size-4" />
          คัดลอกเวลาจันทร์ไปทั้งสัปดาห์
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {DAY_LABELS_TH.map((label, i) => (
          <div
            key={label}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
          >
            <Switch
              checked={days[i].working}
              onCheckedChange={(checked) => updateDay(i, { working: checked })}
              className="data-checked:bg-brand-600"
            />
            <p className="w-20 text-sm font-medium text-foreground">{label}</p>
            {days[i].working ? (
              <div className="flex items-center gap-2">
                <Input
                  value={days[i].startTime}
                  onChange={(e) => updateDay(i, { startTime: e.target.value })}
                  placeholder="09:00"
                  className={cn(FIELD_CLASS, "w-24 text-center")}
                />
                <span className="text-sm text-muted-foreground">ถึง</span>
                <Input
                  value={days[i].endTime}
                  onChange={(e) => updateDay(i, { endTime: e.target.value })}
                  placeholder="17:00"
                  className={cn(FIELD_CLASS, "w-24 text-center")}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">วันหยุด</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => {
            onSave(employee.id, days);
            setSaved(true);
          }}
          className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
        >
          บันทึกตาราง
        </Button>
        {saved && <p className="text-xs text-muted-foreground">บันทึกแล้ว</p>}
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const employees = useMemo(() => getActiveEmployees().filter((e) => e.role === "employee"), []);
  const [tab, setTab] = useState<Tab>("individual");
  const [selectedId, setSelectedId] = useState<string | null>(employees[0]?.id ?? null);
  const [schedules, setSchedules] = useState<MockWorkSchedule[]>(mockWorkSchedules);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [search, setSearch] = useState("");
  // Session-only "reviewed today" marker, so the admin can track who they've
  // already worked through in the list — not persisted to mock data.
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const toggleDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((e) => employeeName(e).toLowerCase().includes(query));
  }, [employees, search]);

  const selectedEmployee = employees.find((e) => e.id === selectedId) ?? null;

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

  const runImport = async (file: File) => {
    const text = await file.text();
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
    const rows = [
      "employee_id,day_of_week,start_time,end_time",
      `${employees[0]?.id ?? "user-1"},1,09:00,17:00`,
      `${employees[0]?.id ?? "user-1"},2,09:00,17:00`,
    ];
    const blob = new Blob([`${rows.join("\n")}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
  };

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col gap-6 px-6 pb-6">
      <header className="relative shrink-0 overflow-hidden rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <div className="absolute top-0 right-0 size-40 -translate-y-1/3 translate-x-1/4 rounded-full bg-white/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold">ตารางงาน</h1>
          <p className="mt-1 text-sm text-white/80">จัดการตารางเวลาทำงานรายสัปดาห์และนำเข้าข้อมูล</p>
        </div>
      </header>

      <div className="relative flex w-full shrink-0 overflow-hidden rounded-xl border border-brand-600/30">
        {/* Sliding fill left square (no own rounding) — the container's
            rounded overflow clips its outer corners, so the two halves meet
            flush at center instead of reading as a floating pill. */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1/2 bg-brand-600 transition-transform duration-300 ease-out",
            tab === "import" && "translate-x-full"
          )}
        />
        <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-brand-600/15" />
        {(
          [
            { id: "individual", label: "แก้ไขทีละคน" },
            { id: "import", label: "นำเข้าจากไฟล์ CSV" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative z-10 flex-1 cursor-pointer py-2 text-sm font-medium transition-colors duration-300",
              tab === t.id ? "text-white" : "text-brand-600"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "individual" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="flex min-h-0 flex-col rounded-2xl border border-slate-200 py-0 ring-0">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาจากชื่อ"
                  className={cn(FIELD_CLASS, "pl-9")}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                {filteredEmployees.map((employee) => {
                  const active = employee.id === selectedId;
                  const done = doneIds.has(employee.id);
                  return (
                    <div
                      key={employee.id}
                      className={cn(
                        "flex items-center gap-1 rounded-xl pr-1 transition-colors",
                        active ? "bg-brand-100" : "hover:bg-muted"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(employee.id)}
                        className={cn(
                          "flex flex-1 cursor-pointer items-center gap-3 px-3 py-2 text-left",
                          active ? "text-brand-600" : "text-foreground",
                          done && "opacity-50"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            active ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-600"
                          )}
                        >
                          {initials(employee)}
                        </div>
                        <span className="truncate text-sm font-medium">{employeeName(employee)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDone(employee.id)}
                        aria-label={done ? "ยกเลิกการทำเครื่องหมายว่าเสร็จ" : "ทำเครื่องหมายว่าเสร็จ"}
                        aria-pressed={done}
                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full"
                      >
                        {done ? (
                          <CheckCircle2 className="size-5 text-success-foreground" />
                        ) : (
                          <Circle className="size-5 text-muted-foreground/50" />
                        )}
                      </button>
                    </div>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <p className="px-3 py-4 text-sm text-muted-foreground">ไม่พบพนักงานที่ตรงกับการค้นหา</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col rounded-2xl border border-slate-200 py-0 ring-0 lg:col-span-2">
            <CardContent className="flex min-h-0 flex-1 flex-col p-5">
              {selectedEmployee ? (
                <ScheduleEditor
                  key={`${selectedEmployee.id}-${scheduleVersion}`}
                  employee={selectedEmployee}
                  schedules={schedules}
                  onSave={handleSave}
                />
              ) : (
                <p className="text-sm text-muted-foreground">เลือกพนักงานจากรายการเพื่อแก้ไขตาราง</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="shrink-0 rounded-2xl border border-slate-200">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <p>
                คอลัมน์ที่ต้องมี: <code className="text-foreground">employee_id</code>,{" "}
                <code className="text-foreground">day_of_week</code> (0-6 โดย 0 = วันอาทิตย์),{" "}
                <code className="text-foreground">start_time</code>,{" "}
                <code className="text-foreground">end_time</code> (รูปแบบ HH:mm)
              </p>
              <p>ข้อมูลเดิมของพนักงานและวันเดียวกันจะถูกแทนที่ด้วยข้อมูลใหม่</p>
            </div>

            <Button
              variant="outline"
              className={cn(ACTION_BUTTON_CLASS, "w-fit border-brand-600/30 bg-brand-100 text-brand-600 hover:bg-brand-100/70")}
              onClick={handleDownloadTemplate}
            >
              ดาวน์โหลดตัวอย่างไฟล์ CSV
            </Button>

            <div className="border-t border-slate-200" />

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                dragActive ? "border-brand-600 bg-brand-100/50" : "border-border hover:bg-muted/50"
              )}
            >
              <Upload className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</p>
              <p className="text-xs text-muted-foreground">รองรับไฟล์ .csv เท่านั้น</p>
              {importFile && (
                <p className="mt-1 text-xs font-medium text-brand-600">{importFile.name}</p>
              )}
            </button>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => importFile && void runImport(importFile)}
                disabled={!importFile}
                className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
              >
                นำเข้าข้อมูล
              </Button>
              {!importFile && (
                <p className="text-xs text-muted-foreground">เลือกไฟล์ก่อนจึงจะนำเข้าได้</p>
              )}
            </div>

            {importResult && (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm">
                <p className="font-medium text-foreground">
                  นำเข้าสำเร็จ {importResult.imported} รายการ
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="flex flex-col gap-1 text-danger-foreground">
                    {importResult.errors.map((e) => (
                      <li key={e.line}>
                        บรรทัด {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

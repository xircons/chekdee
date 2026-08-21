"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Copy, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ACTION_BUTTON_CLASS, FIELD_CLASS } from "@/lib/admin-ui";
import { type Employee, listEmployees } from "@/lib/api-employees";
import { getEmployeeSchedule, replaceEmployeeSchedule } from "@/lib/api-schedules";
import type { MockWorkSchedule } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const DAY_LABELS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const DAY_ABBR_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_COPY_TARGETS = [2, 3, 4, 5]; // Tuesday–Friday, filled from Monday (index 1)
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

type DayEntry = { working: boolean; startTime: string; endTime: string };
type Tab = "individual" | "import";

type ImportRow = { employeeId: string; dayOfWeek: number; startTime: string; endTime: string; line: number };
type ImportError = { line: number; message: string };
type ImportResult = { imported: number; errors: ImportError[] };

// firstName/lastName are nullable on the real Employee (registration may not
// be complete yet) -- falls back to the LINE display name, then the id.
function employeeName(employee: Employee): string {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  return name || employee.lineDisplayName || employee.id;
}

function initials(employee: Employee): string {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.lineDisplayName;
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

// Collapse the sorted day list into ranges: consecutive days become
// "จ–ศ", non-consecutive runs are comma-separated.
function formatDayGroups(days: number[]): string {
  const groups: Array<[number, number]> = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && d === last[1] + 1) last[1] = d;
    else groups.push([d, d]);
  }
  return groups
    .map(([a, b]) => (a === b ? DAY_ABBR_TH[a] : `${DAY_ABBR_TH[a]}–${DAY_ABBR_TH[b]}`))
    .join(", ");
}

// Short saved-schedule summary for the name list; null when the employee
// has no schedule yet. Reads from the saved schedules, not the draft, so
// the list preview reflects what's actually saved.
function scheduleSummary(employeeId: string, schedules: MockWorkSchedule[]): string | null {
  const entries = schedules
    .filter((s) => s.employeeId === employeeId)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  if (entries.length === 0) return null;
  const days = entries.map((e) => e.dayOfWeek);
  return `${formatDayGroups(days)} · ${entries[0].startTime}–${entries[0].endTime}`;
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function validateRow(
  cells: string[],
  validEmployeeIds: Set<string>,
  line: number
): { row?: ImportRow; error?: string } {
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

  return { row: { employeeId, dayOfWeek, startTime, endTime, line } };
}

// DayEntry[] (index = day_of_week) -> the PUT /schedules/:employeeId row
// shape, working days only. DayEntry times are "HH:mm" (native <input
// type="time">, and the CSV format) -- the backend requires "HH:MM:SS".
function daysToScheduleRows(days: DayEntry[]) {
  const effectiveFrom = new Date().toISOString().slice(0, 10);
  return days.flatMap((d, dayOfWeek) =>
    d.working
      ? [
          {
            day_of_week: dayOfWeek,
            start_time: `${d.startTime}:00`,
            end_time: `${d.endTime}:00`,
            effective_from: effectiveFrom,
          },
        ]
      : []
  );
}

function buildDayEntries(employeeId: string, schedules: MockWorkSchedule[]): DayEntry[] {
  return DAY_LABELS_TH.map((_, dayOfWeek) => {
    const entry = schedules.find((s) => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek);
    return entry
      ? { working: true, startTime: entry.startTime, endTime: entry.endTime }
      : { working: false, startTime: "09:00", endTime: "17:00" };
  });
}

// Native time input; the clock icon is a button that opens the browser's
// time picker (falling back to focusing the field where showPicker is
// unsupported). The native picker indicator is hidden so only our icon shows.
function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-32">
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          FIELD_CLASS,
          "w-full pr-9 text-center [&::-webkit-calendar-picker-indicator]:hidden"
        )}
      />
      <button
        type="button"
        aria-label="เลือกเวลา"
        onClick={(e) => {
          const input = e.currentTarget.parentElement?.querySelector("input");
          if (input?.showPicker) input.showPicker();
          else input?.focus();
        }}
        className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-brand-600/20"
      >
        <Clock className="size-3.5" />
      </button>
    </div>
  );
}

function ScheduleEditor({
  employee,
  days,
  dirty,
  onUpdateDay,
  onCopyMonday,
  onSave,
  onCancel,
}: {
  employee: Employee;
  days: DayEntry[];
  dirty: boolean;
  onUpdateDay: (index: number, patch: Partial<DayEntry>) => void;
  onCopyMonday: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const totalMinutes = days.reduce(
    (sum, d) => (d.working ? sum + minutesBetween(d.startTime, d.endTime) : sum),
    0
  );
  const hours = totalMinutes / 60;
  const hoursLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  const workingDays = days.filter((d) => d.working).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-foreground">ตารางของ {employeeName(employee)}</p>
          {/* Rendered always but hidden when clean, so the heading block height stays stable. */}
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground",
              !dirty && "invisible"
            )}
          >
            <span className="size-1.5 rounded-full bg-brand-600" />
            ยังไม่บันทึก
          </span>
        </div>
        <Button variant="outline" className={ACTION_BUTTON_CLASS} onClick={onCopyMonday}>
          <Copy className="size-4" />
          คัดลอกเวลาจันทร์ไปทั้งสัปดาห์
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 pb-5">
        {DAY_LABELS_TH.map((label, i) => (
          <div
            key={label}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
          >
            <Switch
              checked={days[i].working}
              onCheckedChange={(checked) => onUpdateDay(i, { working: checked })}
              className="cursor-pointer data-checked:bg-brand-600"
            />
            <p className="w-20 text-sm font-medium text-foreground">{label}</p>
            {days[i].working ? (
              <div className="flex items-center gap-2">
                <TimeField
                  value={days[i].startTime}
                  onChange={(value) => onUpdateDay(i, { startTime: value })}
                />
                <span className="text-sm text-muted-foreground">ถึง</span>
                <TimeField
                  value={days[i].endTime}
                  onChange={(value) => onUpdateDay(i, { endTime: value })}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">วันหยุด</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          รวม <span className="font-medium text-foreground tabular-nums">{hoursLabel}</span>{" "}
          ชม./สัปดาห์ · ทำงาน{" "}
          <span className="font-medium text-foreground tabular-nums">{workingDays}</span> วัน
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" className={ACTION_BUTTON_CLASS} onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button
            onClick={onSave}
            disabled={!dirty}
            className={cn(ACTION_BUTTON_CLASS, dirty && "bg-accent-600 text-white hover:bg-accent-700")}
          >
            บันทึกตาราง
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tab, setTab] = useState<Tab>("individual");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<MockWorkSchedule[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Per-employee in-progress edits, lifted here so the name list can flag
  // which employees have unsaved changes. Cleared for an employee on
  // save/cancel, so its absence means "clean".
  const [drafts, setDrafts] = useState<Record<string, DayEntry[]>>({});
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

  useEffect(() => {
    listEmployees({ role: "employee", status: "active", limit: 200 })
      .then(async ({ employees: activeEmployees }) => {
        setEmployees(activeEmployees);
        setSelectedId((prev) => prev ?? activeEmployees[0]?.id ?? null);
        // There's no bulk "all schedules" endpoint (see api-schedules.ts) --
        // one GET per employee, in parallel, deduplicated by nothing since
        // every id here is already distinct. Fine at this org's employee
        // count; would need a real batch endpoint to stay fine at scale.
        const perEmployee = await Promise.all(
          activeEmployees.map((e) => getEmployeeSchedule(e.id))
        );
        setSchedules(perEmployee.flat());
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((e) => employeeName(e).toLowerCase().includes(query));
  }, [employees, search]);

  const selectedEmployee = employees.find((e) => e.id === selectedId) ?? null;

  const daysFor = (id: string): DayEntry[] => drafts[id] ?? buildDayEntries(id, schedules);

  const isDirty = (id: string): boolean => {
    const draft = drafts[id];
    if (!draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(buildDayEntries(id, schedules));
  };

  const updateDay = (id: string, index: number, patch: Partial<DayEntry>) => {
    setDrafts((prev) => {
      const base = prev[id] ?? buildDayEntries(id, schedules);
      return { ...prev, [id]: base.map((d, i) => (i === index ? { ...d, ...patch } : d)) };
    });
  };

  const copyMonday = (id: string) => {
    setDrafts((prev) => {
      const base = prev[id] ?? buildDayEntries(id, schedules);
      const monday = base[1];
      return {
        ...prev,
        [id]: base.map((d, i) =>
          WEEKDAY_COPY_TARGETS.includes(i)
            ? { working: true, startTime: monday.startTime, endTime: monday.endTime }
            : d
        ),
      };
    });
  };

  const clearDraft = (id: string) => {
    setDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSave = async (id: string) => {
    setSaveError(null);
    try {
      const saved = await replaceEmployeeSchedule(id, daysToScheduleRows(daysFor(id)));
      setSchedules((prev) => [...prev.filter((s) => s.employeeId !== id), ...saved]);
      clearDraft(id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "บันทึกตารางไม่สำเร็จ");
    }
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
      const { row, error } = validateRow(cells, validEmployeeIds, line);
      if (error) {
        errors.push({ line, message: error });
      } else if (row) {
        validRows.push(row);
      }
    });

    // PUT /schedules/:employeeId replaces that employee's whole week, not
    // just the days present in the file (unlike the old mock's per-row
    // upsert) -- so each touched employee's currently-saved days not
    // mentioned in the CSV must be carried forward, or they'd be silently
    // wiped. One PUT per distinct employee_id in the file.
    const rowsByEmployee = new Map<string, ImportRow[]>();
    for (const row of validRows) {
      const existing = rowsByEmployee.get(row.employeeId) ?? [];
      existing.push(row);
      rowsByEmployee.set(row.employeeId, existing);
    }

    const results = await Promise.allSettled(
      [...rowsByEmployee.entries()].map(async ([employeeId, rows]) => {
        const merged = buildDayEntries(employeeId, schedules).map((day, dayOfWeek) => {
          const override = rows.find((r) => r.dayOfWeek === dayOfWeek);
          return override ? { working: true, startTime: override.startTime, endTime: override.endTime } : day;
        });
        const saved = await replaceEmployeeSchedule(employeeId, daysToScheduleRows(merged));
        return { employeeId, saved };
      })
    );

    let imported = 0;
    const employeeIds = [...rowsByEmployee.keys()];
    setSchedules((prev) => {
      let next = prev;
      results.forEach((result, i) => {
        if (result.status !== "fulfilled") return;
        const { saved } = result.value;
        next = next.filter((s) => s.employeeId !== employeeIds[i]);
        next = [...next, ...saved];
        imported += rowsByEmployee.get(employeeIds[i])?.length ?? 0;
      });
      return next;
    });
    results.forEach((result, i) => {
      if (result.status !== "rejected") return;
      const message = result.reason instanceof Error ? result.reason.message : "บันทึกไม่สำเร็จ";
      for (const row of rowsByEmployee.get(employeeIds[i]) ?? []) {
        errors.push({ line: row.line, message });
      }
    });

    setDrafts({});
    setImportResult({ imported, errors });
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

      {loadError && (
        <p className="text-sm text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
      )}
      {saveError && (
        <p className="text-sm text-danger-foreground">บันทึกไม่สำเร็จ: {saveError}</p>
      )}

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
                  const dirty = isDirty(employee.id);
                  const summary = scheduleSummary(employee.id, schedules);
                  return (
                    <div
                      key={employee.id}
                      className={cn(
                        "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
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
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{employeeName(employee)}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {summary ?? "ยังไม่กำหนดตาราง"}
                          </span>
                        </div>
                      </button>
                      {dirty && (
                        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-600" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDone(employee.id);
                        }}
                        aria-label={done ? "ยกเลิกการทำเครื่องหมายว่าเสร็จ" : "ทำเครื่องหมายว่าเสร็จ"}
                        aria-pressed={done}
                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-brand-600/20"
                      >
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-sm border transition-colors",
                            done ? "border-brand-600 bg-brand-600" : "border-border bg-transparent"
                          )}
                        >
                          <Check
                            className={cn(
                              "size-3.5 transition-opacity",
                              done
                                ? "text-white opacity-100"
                                : "text-muted-foreground opacity-0 group-hover:opacity-40"
                            )}
                          />
                        </span>
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
            {selectedEmployee ? (
              <ScheduleEditor
                employee={selectedEmployee}
                days={daysFor(selectedEmployee.id)}
                dirty={isDirty(selectedEmployee.id)}
                onUpdateDay={(index, patch) => updateDay(selectedEmployee.id, index, patch)}
                onCopyMonday={() => copyMonday(selectedEmployee.id)}
                onSave={() => handleSave(selectedEmployee.id)}
                onCancel={() => clearDraft(selectedEmployee.id)}
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-5">
                <p className="text-sm text-muted-foreground">เลือกพนักงานจากรายการเพื่อแก้ไขตาราง</p>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="shrink-0 rounded-2xl border border-slate-200 ring-0">
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

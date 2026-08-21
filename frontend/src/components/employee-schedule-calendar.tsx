"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, Clock, PartyPopper, Plane } from "lucide-react";

import { DetailModal, DetailModalInfoBlock, type DetailModalBadgeVariant } from "@/components/detail-modal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listHolidays } from "@/lib/api-holidays";
import { listMyLeaveRequests } from "@/lib/api-leave";
import { getMySchedule } from "@/lib/api-schedules";
import type { MockHoliday, MockLeaveRequest, MockWorkSchedule } from "@/lib/mock-data";
import { cn, formatThaiDate, THAI_MONTH_LABELS } from "@/lib/utils";

const WEEKDAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type DayStatus = "workday" | "dayoff" | "holiday" | "leave";

type CalendarDay = {
  date: Date;
  isoDate: string;
  inMonth: boolean;
  isToday: boolean;
  status: DayStatus;
  holidayName: string | null;
  leaveReason: string | null;
  hours: { start: string; end: string } | null;
};

// Exported for the employee attendance heatmap (admin-detail-dialog), which
// reuses this same Sunday-first month-grid layout instead of building its
// own.
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Sunday-first month grid, padded with the leading/trailing days needed to
// fill whole weeks (so the grid is always a clean 7-column table).
export function buildMonthGrid(year: number, monthIndex0: number): Date[][] {
  const firstOfMonth = new Date(year, monthIndex0, 1);
  const leadingDays = firstOfMonth.getDay(); // Sun=0 ... Sat=6
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const totalWeeks = Math.ceil((leadingDays + daysInMonth) / 7);

  const cursor = new Date(year, monthIndex0, 1 - leadingDays);
  const weeks: Date[][] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// Splits a week into runs of same-status days so day-off/holiday stretches
// render as one merged pill instead of separate touching circles.
function runPosition(week: DayStatus[], index: number): { isStart: boolean; isEnd: boolean } {
  return {
    isStart: index === 0 || week[index - 1] !== week[index],
    isEnd: index === week.length - 1 || week[index + 1] !== week[index],
  };
}

const STATUS_PILL: Record<DayStatus, string> = {
  workday: "",
  dayoff: "bg-muted",
  holiday: "bg-warning",
  leave: "bg-success",
};

const STATUS_TEXT: Record<DayStatus, string> = {
  workday: "text-foreground",
  dayoff: "text-muted-foreground",
  holiday: "text-warning-foreground",
  leave: "text-success-foreground",
};

const STATUS_LABEL_TH: Record<DayStatus, string> = {
  workday: "วันทำงาน",
  dayoff: "วันหยุดประจำสัปดาห์",
  holiday: "วันหยุดนักขัตฤกษ์",
  leave: "วันลา",
};

const STATUS_ICON: Record<DayStatus, typeof Clock> = {
  workday: Clock,
  dayoff: CalendarOff,
  holiday: PartyPopper,
  leave: Plane,
};

const STATUS_BADGE_VARIANT: Record<DayStatus, DetailModalBadgeVariant> = {
  workday: "default",
  dayoff: "secondary",
  holiday: "warning",
  leave: "success",
};

export function EmployeeScheduleCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);

  const [schedule, setSchedule] = useState<MockWorkSchedule[]>([]);
  const [holidays, setHolidays] = useState<MockHoliday[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<MockLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // A year back to a year forward from today — the year picker below
    // only offers those three years, so this always covers what's browsable.
    const from = `${today.getFullYear() - 1}-01-01`;
    const to = `${today.getFullYear() + 1}-12-31`;
    Promise.all([getMySchedule(), listHolidays(from, to), listMyLeaveRequests()])
      .then(([scheduleRows, holidayRows, leaveRows]) => {
        setSchedule(scheduleRows);
        setHolidays(holidayRows);
        setLeaveRequests(leaveRows);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleByDayOfWeek = useMemo(
    () => new Map(schedule.map((s) => [s.dayOfWeek, s])),
    [schedule]
  );

  const holidaysByDate = useMemo(() => {
    return new Map(holidays.map((h) => [h.date, h]));
  }, [holidays]);

  // Only approved leave marks a day as "leave" — pending/rejected requests
  // have no bearing on whether the employee actually has that day off.
  // Walks start_date..end_date via local-Date arithmetic (matching
  // buildMonthGrid/toIsoDate elsewhere in this file) rather than
  // `new Date(isoString)`, which parses as UTC and can drift a day off
  // from the local calendar grid depending on the browser's timezone.
  const leaveByDate = useMemo(() => {
    const map = new Map<string, MockLeaveRequest>();
    for (const request of leaveRequests) {
      if (request.status !== "approved") continue;
      const [sy, sm, sd] = request.startDate.split("-").map(Number);
      const [ey, em, ed] = request.endDate.split("-").map(Number);
      const cursor = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      while (cursor <= end) {
        map.set(toIsoDate(cursor), request);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [leaveRequests]);

  const weeks = useMemo(() => {
    const todayIso = toIsoDate(today);
    return buildMonthGrid(viewYear, viewMonth).map((week) =>
      week.map((date): CalendarDay => {
        const isoDate = toIsoDate(date);
        const holiday = holidaysByDate.get(isoDate);
        const leave = leaveByDate.get(isoDate);
        const entry = scheduleByDayOfWeek.get(date.getDay());
        // holiday still wins over leave — an org-wide holiday isn't
        // "spent" as the employee's own leave even if it happens to fall
        // inside an approved range.
        const status: DayStatus = holiday ? "holiday" : leave ? "leave" : entry ? "workday" : "dayoff";
        return {
          date,
          isoDate,
          inMonth: date.getMonth() === viewMonth,
          isToday: isoDate === todayIso,
          status,
          holidayName: holiday?.localName ?? holiday?.name ?? null,
          leaveReason: leave?.reason ?? null,
          hours: entry ? { start: entry.startTime, end: entry.endTime } : null,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, scheduleByDayOfWeek, holidaysByDate, leaveByDate]);

  const monthHolidays = weeks
    .flat()
    .filter((day) => day.inMonth && day.status === "holiday");

  function goToMonth(year: number, month: number) {
    let normYear = year;
    let normMonth = month;
    if (month < 0) {
      normYear = year - 1;
      normMonth = 11;
    } else if (month > 11) {
      normYear = year + 1;
      normMonth = 0;
    }
    const current = viewYear * 12 + viewMonth;
    const target = normYear * 12 + normMonth;
    setSlideDirection(target === current ? null : target > current ? "next" : "prev");
    setViewYear(normYear);
    setViewMonth(normMonth);
  }

  const yearOptions = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

  if (loading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด…</p>;
  }
  if (loadError) {
    return (
      <p className="py-6 text-center text-sm text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="เดือนก่อนหน้า"
          onClick={() => goToMonth(viewYear, viewMonth - 1)}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex flex-1 items-center justify-center gap-2">
          <Select
            value={String(viewMonth)}
            onValueChange={(value) => goToMonth(viewYear, Number(value))}
          >
            <SelectTrigger className="justify-center rounded-full border border-border bg-muted/40 px-4 font-medium">
              <SelectValue>{(value: string) => THAI_MONTH_LABELS[Number(value)]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {THAI_MONTH_LABELS.map((label, index) => (
                <SelectItem key={label} value={String(index)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(viewYear)}
            onValueChange={(value) => goToMonth(Number(value), viewMonth)}
          >
            <SelectTrigger className="justify-center rounded-full border border-border bg-muted/40 px-4 font-medium">
              <SelectValue>{(value: string) => Number(value) + 543}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year + 543}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          aria-label="เดือนถัดไป"
          onClick={() => goToMonth(viewYear, viewMonth + 1)}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="overflow-hidden">
        <div className="flex">
          {WEEKDAY_LABELS_TH.map((label) => (
            <div
              key={label}
              className="flex-1 pb-2 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        <div
          key={`${viewYear}-${viewMonth}`}
          className={cn(
            "flex flex-col duration-300 animate-in",
            slideDirection === "next" && "slide-in-from-right-8",
            slideDirection === "prev" && "slide-in-from-left-8"
          )}
        >
          {weeks.map((week, weekIndex) => {
            const statuses = week.map((d) => d.status);
            return (
              <div key={weekIndex} className="flex">
                {week.map((day, dayIndex) => {
                  const { isStart, isEnd } = runPosition(statuses, dayIndex);
                  const showPill = day.inMonth && day.status !== "workday";
                  return (
                    <div key={day.isoDate} className="relative flex-1 py-0.5">
                      {showPill && (
                        <div
                          className={cn(
                            "absolute inset-y-0.5",
                            isStart ? "left-0.5 rounded-l-full" : "left-0",
                            isEnd ? "right-0.5 rounded-r-full" : "right-0",
                            STATUS_PILL[day.status]
                          )}
                          aria-hidden
                        />
                      )}
                      <button
                        type="button"
                        disabled={!day.inMonth}
                        onClick={() => {
                          setSelectedDay(day);
                          setDayModalOpen(true);
                        }}
                        className={cn(
                          "relative z-10 mx-auto flex size-9 cursor-pointer items-center justify-center rounded-full text-sm tabular-nums transition-[transform,background-color] disabled:cursor-default",
                          day.inMonth ? STATUS_TEXT[day.status] : "text-muted-foreground/30",
                          day.inMonth && "hover:bg-brand-600/10 active:scale-90",
                          day.isToday && "font-bold ring-2 ring-brand-600"
                        )}
                      >
                        {day.date.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-border" /> วันทำงาน
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted" /> วันหยุด
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-warning" /> วันหยุดนักขัตฤกษ์
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-success" /> วันลา
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full ring-2 ring-brand-600" /> วันนี้
        </span>
      </div>

      {monthHolidays.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          {monthHolidays.map((day) => (
            <div key={day.isoDate} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{day.holidayName}</span>
              <span className="text-muted-foreground">
                {day.date.toLocaleDateString([], { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}

      <DetailModal
        open={dayModalOpen}
        onOpenChange={setDayModalOpen}
        size="compact"
        icon={selectedDay ? STATUS_ICON[selectedDay.status] : Clock}
        title={selectedDay ? formatThaiDate(selectedDay.date) : ""}
        badgeText={
          selectedDay
            ? STATUS_LABEL_TH[selectedDay.status] + (selectedDay.isToday ? " · วันนี้" : "")
            : ""
        }
        badgeVariant={selectedDay ? STATUS_BADGE_VARIANT[selectedDay.status] : "default"}
        footer={
          <Button
            className="h-11 w-full rounded-full bg-accent-600 font-semibold text-white hover:bg-accent-700"
            onClick={() => setDayModalOpen(false)}
          >
            ตกลง
          </Button>
        }
      >
        <DetailModalInfoBlock
          label={
            selectedDay?.status === "workday"
              ? "เวลาทำงาน"
              : selectedDay?.status === "holiday"
                ? "ชื่อวันหยุด"
                : selectedDay?.status === "leave"
                  ? "เหตุผลการลา"
                  : "สถานะ"
          }
          value={
            selectedDay?.status === "workday" && selectedDay.hours
              ? `${selectedDay.hours.start} – ${selectedDay.hours.end}`
              : selectedDay?.status === "holiday" && selectedDay.holidayName
                ? selectedDay.holidayName
                : selectedDay?.status === "leave"
                  ? (selectedDay.leaveReason ?? "ลาที่ได้รับอนุมัติ")
                  : "ไม่มีตารางทำงานในวันนี้"
          }
          valueSize={selectedDay?.status === "workday" ? "lg" : "sm"}
        />
      </DetailModal>
    </div>
  );
}

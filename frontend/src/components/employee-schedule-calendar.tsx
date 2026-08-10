"use client";

import { useMemo, useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, Clock, PartyPopper } from "lucide-react";

import { DetailModal, DetailModalInfoBlock, type DetailModalBadgeVariant } from "@/components/detail-modal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getWorkScheduleForEmployee, mockHolidays } from "@/lib/mock-data";
import { cn, formatThaiDate, THAI_MONTH_LABELS } from "@/lib/utils";

const WEEKDAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type DayStatus = "workday" | "dayoff" | "holiday";

type CalendarDay = {
  date: Date;
  isoDate: string;
  inMonth: boolean;
  isToday: boolean;
  status: DayStatus;
  holidayName: string | null;
  hours: { start: string; end: string } | null;
};

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Sunday-first month grid, padded with the leading/trailing days needed to
// fill whole weeks (so the grid is always a clean 7-column table).
function buildMonthGrid(year: number, monthIndex0: number): Date[][] {
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
};

const STATUS_TEXT: Record<DayStatus, string> = {
  workday: "text-foreground",
  dayoff: "text-muted-foreground",
  holiday: "text-warning-foreground",
};

const STATUS_LABEL_TH: Record<DayStatus, string> = {
  workday: "วันทำงาน",
  dayoff: "วันหยุดประจำสัปดาห์",
  holiday: "วันหยุดนักขัตฤกษ์",
};

const STATUS_ICON: Record<DayStatus, typeof Clock> = {
  workday: Clock,
  dayoff: CalendarOff,
  holiday: PartyPopper,
};

const STATUS_BADGE_VARIANT: Record<DayStatus, DetailModalBadgeVariant> = {
  workday: "default",
  dayoff: "secondary",
  holiday: "warning",
};

export function EmployeeScheduleCalendar({ employeeId }: { employeeId: string }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const schedule = useMemo(() => getWorkScheduleForEmployee(employeeId), [employeeId]);
  const scheduleByDayOfWeek = useMemo(
    () => new Map(schedule.map((s) => [s.dayOfWeek, s])),
    [schedule]
  );

  const holidaysByDate = useMemo(() => {
    return new Map(mockHolidays.map((h) => [h.date, h]));
  }, []);

  const weeks = useMemo(() => {
    const todayIso = toIsoDate(today);
    return buildMonthGrid(viewYear, viewMonth).map((week) =>
      week.map((date): CalendarDay => {
        const isoDate = toIsoDate(date);
        const holiday = holidaysByDate.get(isoDate);
        const entry = scheduleByDayOfWeek.get(date.getDay());
        const status: DayStatus = holiday ? "holiday" : entry ? "workday" : "dayoff";
        return {
          date,
          isoDate,
          inMonth: date.getMonth() === viewMonth,
          isToday: isoDate === todayIso,
          status,
          holidayName: holiday?.localName ?? holiday?.name ?? null,
          hours: entry ? { start: entry.startTime, end: entry.endTime } : null,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, scheduleByDayOfWeek, holidaysByDate]);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="เดือนก่อนหน้า"
          onClick={() => goToMonth(viewYear, viewMonth - 1)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
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
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
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
            "flex flex-col duration-300 animate-in fade-in-0",
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
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                          "relative z-10 mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                          day.inMonth ? STATUS_TEXT[day.status] : "text-muted-foreground/30",
                          day.inMonth && "hover:bg-brand-600/10",
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
        open={selectedDay !== null}
        onOpenChange={(open) => !open && setSelectedDay(null)}
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
            onClick={() => setSelectedDay(null)}
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
                : "สถานะ"
          }
          value={
            selectedDay?.status === "workday" && selectedDay.hours
              ? `${selectedDay.hours.start} – ${selectedDay.hours.end}`
              : selectedDay?.status === "holiday" && selectedDay.holidayName
                ? selectedDay.holidayName
                : "ไม่มีตารางทำงานในวันนี้"
          }
          valueSize={selectedDay?.status === "workday" ? "lg" : "sm"}
        />
      </DetailModal>
    </div>
  );
}

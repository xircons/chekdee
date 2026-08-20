"use client";

import { useMemo } from "react";

import { buildMonthGrid, toIsoDate } from "@/components/employee-schedule-calendar";
import {
  getAttendanceForEmployee,
  getWorkScheduleForEmployee,
  mockHolidays,
  mockLeaveRequests,
  type AttendanceStatus,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type HeatmapState = "present" | "สาย" | "ขาด" | "leave" | "holiday" | "off";

// Reuses the same status colors used elsewhere in the app (badge variants,
// the schedule calendar's holiday/dayoff pills) rather than introducing a
// new palette just for this grid. สาย and holiday share the warning hue —
// they never land on the same cell — distinguished only by opacity so
// they're still tellable apart at a glance.
const STATE_CLASS: Record<HeatmapState, string> = {
  present: "bg-success text-success-foreground",
  สาย: "bg-warning text-warning-foreground",
  ขาด: "bg-danger text-danger-foreground",
  leave: "bg-brand-100 text-brand-600",
  holiday: "bg-warning/50 text-warning-foreground",
  off: "bg-muted text-muted-foreground",
};

const STATE_LABEL_TH: Record<HeatmapState, string> = {
  present: "มาปกติ",
  สาย: "สาย",
  ขาด: "ขาด",
  leave: "ลา",
  holiday: "วันหยุดนักขัตฤกษ์",
  off: "ไม่มีตารางทำงาน",
};

const LEGEND_ORDER: HeatmapState[] = ["present", "สาย", "ขาด", "leave", "holiday", "off"];

type HeatmapDay = {
  isoDate: string;
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  state: HeatmapState | null; // null: scheduled workday with no data yet
};

export function EmployeeAttendanceHeatmap({ employeeId }: { employeeId: string }) {
  const today = useMemo(() => new Date(), []);
  const todayIso = toIsoDate(today);

  const records = useMemo(() => getAttendanceForEmployee(employeeId), [employeeId]);
  const recordsByDate = useMemo(() => new Map(records.map((r) => [r.workDate, r])), [records]);

  const schedule = useMemo(() => getWorkScheduleForEmployee(employeeId), [employeeId]);
  const scheduleByDayOfWeek = useMemo(
    () => new Map(schedule.map((s) => [s.dayOfWeek, s])),
    [schedule]
  );

  const approvedLeave = useMemo(
    () => mockLeaveRequests.filter((r) => r.employeeId === employeeId && r.status === "approved"),
    [employeeId]
  );

  const holidaysByDate = useMemo(() => new Map(mockHolidays.map((h) => [h.date, h])), []);

  const weeks = useMemo(() => {
    return buildMonthGrid(today.getFullYear(), today.getMonth()).map((week) =>
      week.map((date): HeatmapDay => {
        const isoDate = toIsoDate(date);
        const inMonth = date.getMonth() === today.getMonth();

        const record = recordsByDate.get(isoDate);
        const onLeave = approvedLeave.some((r) => r.startDate <= isoDate && isoDate <= r.endDate);
        const isHoliday = holidaysByDate.has(isoDate);
        const isScheduled = scheduleByDayOfWeek.has(date.getDay());

        let state: HeatmapState | null;
        if (record?.status === "present" || record?.status === "สาย" || record?.status === "ขาด") {
          state = record.status as AttendanceStatus;
        } else if (onLeave) {
          state = "leave";
        } else if (isHoliday) {
          state = "holiday";
        } else if (!isScheduled) {
          state = "off";
        } else {
          state = null;
        }

        return { isoDate, date, inMonth, isToday: isoDate === todayIso, state };
      })
    );
  }, [today, recordsByDate, approvedLeave, holidaysByDate, scheduleByDayOfWeek, todayIso]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex">
        {WEEKDAY_LABELS_TH.map((label) => (
          <div key={label} className="flex-1 text-center text-[10px] font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex gap-0.5">
            {week.map((day) => (
              <div
                key={day.isoDate}
                title={`${day.date.getDate()} · ${day.state ? STATE_LABEL_TH[day.state] : "ยังไม่มีข้อมูล"}`}
                className={cn(
                  "flex aspect-square flex-1 items-center justify-center rounded-md text-[10px] tabular-nums",
                  !day.inMonth && "opacity-0",
                  day.inMonth && day.state && STATE_CLASS[day.state],
                  day.inMonth && !day.state && "border border-border text-muted-foreground/60",
                  day.isToday && "ring-2 ring-brand-600"
                )}
              >
                {day.date.getDate()}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] text-muted-foreground">
        {LEGEND_ORDER.map((state) => (
          <span key={state} className="flex items-center gap-1">
            <span className={cn("size-2 rounded-sm", STATE_CLASS[state])} />
            {STATE_LABEL_TH[state]}
          </span>
        ))}
      </div>
    </div>
  );
}

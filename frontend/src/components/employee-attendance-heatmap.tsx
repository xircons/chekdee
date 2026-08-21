"use client";

import { useEffect, useMemo, useState } from "react";

import { buildMonthGrid, toIsoDate } from "@/components/employee-schedule-calendar";
import { listHolidays } from "@/lib/api-holidays";
import { listAllLeaveRequests } from "@/lib/api-leave";
import { getDailyLog, type DailyLogRow } from "@/lib/api-reports";
import { getEmployeeSchedule } from "@/lib/api-schedules";
import type { MockHoliday, MockLeaveRequest, MockWorkSchedule } from "@/lib/mock-data";
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

// DailyLogRow.status is the backend's English enum -- present/late/absent
// (pending is a DB-default sentinel CheckIn never actually returns).
function toHeatmapState(status: DailyLogRow["status"]): HeatmapState | null {
  switch (status) {
    case "present":
      return "present";
    case "late":
      return "สาย";
    case "absent":
      return "ขาด";
    default:
      return null;
  }
}

export function EmployeeAttendanceHeatmap({ employeeId }: { employeeId: string }) {
  const today = useMemo(() => new Date(), []);
  const todayIso = toIsoDate(today);
  const monthIso = todayIso.slice(0, 7);

  const [dailyLog, setDailyLog] = useState<DailyLogRow[]>([]);
  const [schedule, setSchedule] = useState<MockWorkSchedule[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<MockLeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<MockHoliday[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const monthStart = `${monthIso}-01`;
    const monthEnd = toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

    // No per-employee "approved leave" endpoint -- GET /leave-requests is
    // org-wide (admin-only, which this page already requires), filtered to
    // this employee client-side.
    Promise.all([
      getDailyLog(monthIso, employeeId),
      getEmployeeSchedule(employeeId),
      listAllLeaveRequests(),
      listHolidays(monthStart, monthEnd),
    ])
      .then(([logRows, scheduleRows, leaveRows, holidayRows]) => {
        setDailyLog(logRows);
        setSchedule(scheduleRows);
        setLeaveRequests(leaveRows.filter((r) => r.employeeId === employeeId && r.status === "approved"));
        setHolidays(holidayRows);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, [employeeId, monthIso, today]);

  const recordsByDate = useMemo(() => new Map(dailyLog.map((r) => [r.date, r])), [dailyLog]);
  const scheduleByDayOfWeek = useMemo(
    () => new Map(schedule.map((s) => [s.dayOfWeek, s])),
    [schedule]
  );
  const holidaysByDate = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);

  const weeks = useMemo(() => {
    return buildMonthGrid(today.getFullYear(), today.getMonth()).map((week) =>
      week.map((date): HeatmapDay => {
        const isoDate = toIsoDate(date);
        const inMonth = date.getMonth() === today.getMonth();

        const record = recordsByDate.get(isoDate);
        const onLeave = leaveRequests.some((r) => r.startDate <= isoDate && isoDate <= r.endDate);
        const isHoliday = holidaysByDate.has(isoDate);
        const isScheduled = scheduleByDayOfWeek.has(date.getDay());

        let state: HeatmapState | null;
        if (record) {
          state = toHeatmapState(record.status);
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
  }, [today, recordsByDate, leaveRequests, holidaysByDate, scheduleByDayOfWeek, todayIso]);

  return (
    <div className="flex flex-col gap-2">
      {loadError && (
        <p className="text-xs text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
      )}

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

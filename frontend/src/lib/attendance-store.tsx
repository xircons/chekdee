"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { getTodayAttendance } from "@/lib/api-attendance";

// In-memory cache of today's attendance_records row, hydrated from
// GET /attendance/me/today on mount (see the effect below) and updated
// optimistically by checkIn()/checkOut() right after those actions
// succeed, so the UI doesn't wait on a second round-trip just to reflect
// what the check-in/out call itself already confirmed.
export type TodayAttendance = {
  checkInAt: string | null;
  checkOutAt: string | null;
};

type AttendanceContextValue = {
  today: TodayAttendance;
  checkIn: (timeOfDay?: string) => void;
  checkOut: (timeOfDay?: string) => void;
};

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

// Combines a backend "HH:MM:SS" time-of-day with today's local date, so
// display code that formats via `new Date(iso).toLocaleTimeString()`
// doesn't need to change for a real check-in time vs. the mock's
// new Date().toISOString().
function timeOfDayToIsoToday(timeOfDay: string): string {
  const [h, m, s] = timeOfDay.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, s ?? 0, 0);
  return d.toISOString();
}

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [today, setToday] = useState<TodayAttendance>({ checkInAt: null, checkOutAt: null });

  useEffect(() => {
    getTodayAttendance()
      .then((record) => {
        if (!record) return;
        setToday({
          checkInAt: record.check_in_at ? timeOfDayToIsoToday(record.check_in_at) : null,
          checkOutAt: record.check_out_at ? timeOfDayToIsoToday(record.check_out_at) : null,
        });
      })
      .catch(() => {
        // Best-effort hydration: a failed fetch just leaves the status
        // blank (same as before this endpoint existed) rather than
        // blocking the page or surfacing an error banner for a
        // non-critical background refresh.
      });
  }, []);

  const checkIn = (timeOfDay?: string) =>
    setToday({ checkInAt: timeOfDay ? timeOfDayToIsoToday(timeOfDay) : new Date().toISOString(), checkOutAt: null });
  const checkOut = (timeOfDay?: string) =>
    setToday((t) => ({ ...t, checkOutAt: timeOfDay ? timeOfDayToIsoToday(timeOfDay) : new Date().toISOString() }));

  return (
    <AttendanceContext.Provider value={{ today, checkIn, checkOut }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useTodayAttendance(): AttendanceContextValue {
  const ctx = useContext(AttendanceContext);
  if (!ctx) {
    throw new Error("useTodayAttendance() must be used inside AttendanceProvider");
  }
  return ctx;
}

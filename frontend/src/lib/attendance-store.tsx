"use client";

import { createContext, useContext, useState } from "react";

// In-memory stand-in for today's attendance_records row — resets on
// reload. Geofence/WiFi verification is backend work (PLAN.md Phase 4);
// this only stubs the interaction so the dashboard's check-in/out CTA has
// something to react to.
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

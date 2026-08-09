"use client";

import { createContext, useContext, useState } from "react";

// In-memory stand-in for today's attendance_records row — resets on
// reload. Geofence/WiFi verification is backend work (PLAN.md Phase 4);
// this only stubs the interaction so the check-in/out screen has
// something to react to.
export type TodayAttendance = {
  checkInAt: string | null;
  checkOutAt: string | null;
};

type AttendanceContextValue = {
  today: TodayAttendance;
  checkIn: () => void;
  checkOut: () => void;
};

const AttendanceContext = createContext<AttendanceContextValue | null>(null);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [today, setToday] = useState<TodayAttendance>({ checkInAt: null, checkOutAt: null });

  const checkIn = () => setToday({ checkInAt: new Date().toISOString(), checkOutAt: null });
  const checkOut = () => setToday((t) => ({ ...t, checkOutAt: new Date().toISOString() }));

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

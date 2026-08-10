import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const THAI_DAY_LABELS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
]

export const THAI_MONTH_LABELS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
]

// Formats a Date using the Thai solar calendar (Buddhist Era, year + 543).
export function formatThaiDate(date: Date): string {
  return `${date.getDate()} ${THAI_MONTH_LABELS[date.getMonth()]} ${date.getFullYear() + 543}`
}

export function parseIsoDateLocal(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

// "วันศุกร์ที่ 29 พฤษภาคม 2569"
export function formatThaiDateWithDay(date: Date): string {
  return `วัน${THAI_DAY_LABELS[date.getDay()]}ที่ ${formatThaiDate(date)}`
}

// "20-21 สิงหาคม 2569" when the range stays within one month, otherwise
// falls back to the full "20 สิงหาคม 2569 ถึง 3 กันยายน 2569" form.
export function formatThaiDateRange(startIso: string, endIso: string): string {
  const start = parseIsoDateLocal(startIso)
  if (startIso === endIso) return formatThaiDate(start)

  const end = parseIsoDateLocal(endIso)
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()

  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${THAI_MONTH_LABELS[start.getMonth()]} ${start.getFullYear() + 543}`
  }
  return `${formatThaiDate(start)} ถึง ${formatThaiDate(end)}`
}

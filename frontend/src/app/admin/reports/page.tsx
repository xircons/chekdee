"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDailyLogForMonth,
  getMonthlyReportRows,
  type AttendanceStatus,
} from "@/lib/mock-data";
import { THAI_MONTH_LABELS } from "@/lib/utils";

const ACTION_BUTTON_CLASS = "h-9 rounded-lg px-5 text-sm";
const SELECT_TRIGGER_CLASS =
  "h-9 w-44 rounded-lg border-border bg-muted/40 px-4 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20 data-[size=default]:h-9";

const STATUS_LABEL_TH: Record<AttendanceStatus, string> = {
  present: "มาปกติ",
  สาย: "สาย",
  ขาด: "ขาด",
};

// Roughly how long the (nonexistent) backend job queue would take to build
// and email a report — long enough that the "กำลังประมวลผล..." state reads
// as real work, short enough not to feel broken.
const SIMULATED_PROCESSING_MS_MIN = 1500;
const SIMULATED_PROCESSING_MS_SPAN = 500;

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getRecentMonthOptions(count: number): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: `${THAI_MONTH_LABELS[date.getMonth()]} ${date.getFullYear() + 543}`,
    };
  });
}

function formatTimeTh(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildReportWorkbook(yearMonth: string): XLSX.WorkBook {
  const rows = getMonthlyReportRows(yearMonth);
  const dailyLog = getDailyLogForMonth(yearMonth);

  const summarySheetData = [
    [
      "ชื่อ",
      "รุ่น",
      "จำนวนวันทำงาน",
      "จำนวนครั้งที่สาย",
      "นาทีสายรวม",
      "จำนวนวันขาด",
      "จำนวนวันลา",
      "ชั่วโมงทำงานรวม",
    ],
    ...rows.map((row) => [
      `${row.employee.firstName} ${row.employee.lastName}`,
      row.employee.studentGen ?? "-",
      row.workDays,
      row.lateCount,
      row.lateMinutes,
      row.absentCount,
      row.leaveDays,
      row.workedHours,
    ]),
  ];

  const dailySheetData = [
    ["วันที่", "พนักงาน", "สถานะ", "เวลาเข้า", "เวลาออก", "หมายเหตุ"],
    ...dailyLog.map((row) => [
      row.date,
      row.employeeName,
      row.status ? STATUS_LABEL_TH[row.status] : "-",
      formatTimeTh(row.checkInAt),
      formatTimeTh(row.checkOutAt),
      row.notes,
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summarySheetData), "สรุป");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(dailySheetData),
    "รายละเอียดรายวัน"
  );
  return workbook;
}

export default function ReportsPage() {
  const monthOptions = useMemo(() => getRecentMonthOptions(12), []);
  const [yearMonth, setYearMonth] = useState<string>(currentYearMonth);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(
      () => {
        const workbook = buildReportWorkbook(yearMonth);
        const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `รายงานการเข้างาน-${yearMonth}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      },
      SIMULATED_PROCESSING_MS_MIN + Math.random() * SIMULATED_PROCESSING_MS_SPAN
    );
  };

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 pb-6">
      <header className="rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">รายงาน</h1>
        <p className="mt-1 text-sm text-white/80">สรุปและส่งออกข้อมูลการเข้างานรายเดือน</p>
      </header>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardHeader>
          <CardTitle>ส่งออกรายงานรายเดือน</CardTitle>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={yearMonth} onValueChange={(value) => value && setYearMonth(value)}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                  <SelectValue>
                    {(value: string | null) =>
                      monthOptions.find((m) => m.value === value)?.label ?? ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} sideOffset={4}>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={isExporting}
                onClick={handleExport}
                className={`${ACTION_BUTTON_CLASS} bg-accent-600 text-white hover:bg-accent-700`}
              >
                {isExporting ? "กำลังประมวลผล..." : "ส่งออกเป็น Excel"}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>ไฟล์ Excel ที่ส่งออกจะมี 2 ชีต:</p>
          <ul className="list-disc pl-5">
            <li>
              <span className="font-medium text-foreground">สรุป</span> — หนึ่งแถวต่อพนักงานหนึ่งคน
              พร้อมจำนวนวันทำงาน จำนวนครั้งที่สายและนาทีสายรวม จำนวนวันขาด จำนวนวันลา
              และชั่วโมงทำงานรวม
            </li>
            <li>
              <span className="font-medium text-foreground">รายละเอียดรายวัน</span> —
              ประวัติการเข้างานรายวันตลอดเดือน สำหรับใช้อ้างอิงหรือกรณีมีข้อโต้แย้ง
            </li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

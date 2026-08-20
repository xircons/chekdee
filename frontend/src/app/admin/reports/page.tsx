"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACTION_BUTTON_CLASS } from "@/lib/admin-ui";
import { getMonthlyReportRows, type MonthlyReportRow } from "@/lib/mock-data";
import { downloadReportWorkbook } from "@/lib/report-export";
import { useMe } from "@/lib/session";
import { cn, THAI_MONTH_LABELS } from "@/lib/utils";

const SELECT_TRIGGER_CLASS =
  "h-9 w-44 rounded-lg border-border bg-muted/40 px-4 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20 data-[size=default]:h-9";

// Starting guess for how many rows fit before the table container has been
// measured. Actual page size is recalculated from the container's real
// height right after mount (see useSummaryPageSize below) so the visible
// rows exactly fill the space instead of overflowing or leaving a gap.
const INITIAL_PAGE_SIZE = 10;

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

function sumBy(rows: MonthlyReportRow[], pick: (row: MonthlyReportRow) => number): number {
  return rows.reduce((sum, row) => sum + pick(row), 0);
}

// ui/table.tsx's shared TableCell/TableHead padding (p-2 / h-10) renders a
// visibly shorter row here than on /admin/employees or /admin/leave-requests
// — those rows get extra height for free from an avatar circle or a status
// badge, this table is plain text. Scoped to this table only (not the
// shared component, which would affect every other page) so body rows land
// close to leave-requests's ~50-52px instead of ui/table.tsx's bare ~43-45px.
// h-auto overrides TableHead's fixed h-10 so the header's height comes from
// the same padding math as the body rows, instead of a separately-guessed
// pixel value that could drift out of sync with them.
const REPORT_CELL_PADDING = "py-3.5";
const REPORT_HEADER_PADDING = "h-auto py-3.5";

// Measures the actual header/body/footer row heights that table.tsx renders
// and divides the container's real height by them, so the page shows
// close to as many employee rows as fit with minimal leftover gap. Rounds
// down with an extra pixel buffer (FIT_SAFETY_MARGIN_PX) so a slightly
// generous estimate never overshoots into clipping the last row - the
// container still scrolls (see the overflow-y-auto wrapper in ReportsPage)
// as a safety net for the rare case a row's real height varies from the
// sampled one. A callback ref (rather than useRef + useEffect) so the
// ResizeObserver attaches and detaches correctly across the "no data this
// month" branch unmounting/remounting the container.
const FIT_SAFETY_MARGIN_PX = 4;

function useSummaryPageSize(): [(node: HTMLDivElement | null) => void, number] {
  const [pageSize, setPageSize] = useState(INITIAL_PAGE_SIZE);
  const observerRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;

    const recompute = () => {
      const headerRow = node.querySelector('[data-slot="table-header"] tr');
      const bodyRow = node.querySelector('[data-slot="table-body"] tr');
      const footerRow = node.querySelector('[data-slot="table-footer"] tr');
      if (!headerRow || !bodyRow || !footerRow) return;

      const available =
        node.clientHeight -
        headerRow.getBoundingClientRect().height -
        footerRow.getBoundingClientRect().height -
        FIT_SAFETY_MARGIN_PX;
      const rowsThatFit = Math.max(1, Math.floor(available / bodyRow.getBoundingClientRect().height));
      setPageSize((prev) => (prev === rowsThatFit ? prev : rowsThatFit));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return [containerRef, pageSize];
}

// pageRows drives the visible table body; allRows drives the totals row, so
// the total always reflects the whole month even while a single page of
// employees is showing.
function MonthlySummaryTable({
  pageRows,
  allRows,
}: {
  pageRows: MonthlyReportRow[];
  allRows: MonthlyReportRow[];
}) {
  return (
    // table-fixed + matching widths on every column, same convention as
    // leave-requests/page.tsx — without it, table-auto recomputes each
    // column's width from whichever names/values are on the current page,
    // so the columns visibly shift between pages instead of staying put.
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[22%]")}>ชื่อ</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[13%]")}>รหัสนักศึกษา</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[8%]")}>รุ่น</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[12%] text-right")}>จำนวนวันทำงาน</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[11%] text-right")}>สาย (ครั้ง)</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[11%] text-right")}>นาทีสายรวม</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[8%] text-right")}>ขาด</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[7%] text-right")}>ลา</TableHead>
          <TableHead className={cn(REPORT_HEADER_PADDING, "w-[8%] text-right")}>ชั่วโมงรวม</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pageRows.map((row) => (
          <TableRow key={row.employee.id}>
            <TableCell className={cn(REPORT_CELL_PADDING, "truncate font-medium text-foreground")}>
              {row.employee.firstName} {row.employee.lastName}
            </TableCell>
            <TableCell className={REPORT_CELL_PADDING}>{row.employee.studentId ?? "-"}</TableCell>
            <TableCell className={REPORT_CELL_PADDING}>{row.employee.studentGen ?? "-"}</TableCell>
            <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
              {row.workDays}
            </TableCell>
            <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
              {row.lateCount}
            </TableCell>
            <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
              {row.lateMinutes}
            </TableCell>
            <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
              {row.absentCount}
            </TableCell>
            <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
              {row.leaveDays}
            </TableCell>
            <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
              {row.workedHours}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow className="bg-card font-medium">
          <TableCell colSpan={3} className={REPORT_CELL_PADDING}>
            รวมทั้งหมด ({allRows.length} คน)
          </TableCell>
          <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
            {sumBy(allRows, (r) => r.workDays)}
          </TableCell>
          <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
            {sumBy(allRows, (r) => r.lateCount)}
          </TableCell>
          <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
            {sumBy(allRows, (r) => r.lateMinutes)}
          </TableCell>
          <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
            {sumBy(allRows, (r) => r.absentCount)}
          </TableCell>
          <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
            {sumBy(allRows, (r) => r.leaveDays)}
          </TableCell>
          <TableCell className={cn(REPORT_CELL_PADDING, "text-right tabular-nums")}>
            {sumBy(allRows, (r) => r.workedHours)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export default function ReportsPage() {
  const me = useMe();
  const monthOptions = useMemo(() => getRecentMonthOptions(12), []);
  const [yearMonth, setYearMonth] = useState<string>(currentYearMonth);
  const [isExporting, setIsExporting] = useState(false);

  const rows = useMemo(() => getMonthlyReportRows(yearMonth), [yearMonth]);
  const selectedMonthLabel = monthOptions.find((m) => m.value === yearMonth)?.label ?? "";

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.absentCount - a.absentCount),
    [rows]
  );

  const [summaryScrollRef, pageSize] = useSummaryPageSize();
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageResetKey, setSummaryPageResetKey] = useState("");
  // Jump back to page 1 whenever the selected month changes, so switching
  // months never leaves the table stuck on a now out-of-range page.
  if (yearMonth !== summaryPageResetKey) {
    setSummaryPageResetKey(yearMonth);
    setSummaryPage(1);
  }
  const summaryTotalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentSummaryPage = Math.min(summaryPage, summaryTotalPages);
  const pagedRows = sortedRows.slice(
    (currentSummaryPage - 1) * pageSize,
    currentSummaryPage * pageSize
  );

  const handleExport = () => {
    setIsExporting(true);
    const generatedByName = me.display_name ?? "ผู้ดูแลระบบ";
    setTimeout(
      () => {
        void downloadReportWorkbook(yearMonth, generatedByName).finally(() => {
          setIsExporting(false);
        });
      },
      SIMULATED_PROCESSING_MS_MIN + Math.random() * SIMULATED_PROCESSING_MS_SPAN
    );
  };

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col gap-6 px-6 pb-6">
      <header className="shrink-0 rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">รายงาน</h1>
        <p className="mt-1 text-sm text-white/80">สรุปและส่งออกข้อมูลการเข้างานรายเดือน</p>
      </header>

      <Card className="shrink-0 rounded-2xl border border-slate-200 ring-0">
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
          <p>ไฟล์ Excel ที่ส่งออกจะมีชีต &quot;สรุป&quot; หนึ่งชีต และชีตแยกรายบุคคลอีกหนึ่งชีตต่อพนักงานหนึ่งคน:</p>
          <ul className="list-disc pl-5">
            <li>
              <span className="font-medium text-foreground">สรุป</span>: หนึ่งแถวต่อพนักงานหนึ่งคน
              พร้อมจำนวนวันทำงาน จำนวนครั้งที่สายและนาทีสายรวม จำนวนวันขาด จำนวนวันลา ชั่วโมงทำงานรวม
              และช่องค้นหารายคนแบบเร็ว
            </li>
            <li>
              <span className="font-medium text-foreground">ชีตรายบุคคล</span>:
              ประวัติการเข้างานรายวันของพนักงานแต่ละคนตลอดเดือน สำหรับใช้อ้างอิงหรือกรณีมีข้อโต้แย้ง
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 ring-0">
        <CardHeader className="shrink-0">
          <CardTitle>สรุปรายเดือน</CardTitle>
          <CardDescription>ข้อมูลประจำเดือน{selectedMonthLabel}</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          {sortedRows.length > 0 ? (
            <>
              <div ref={summaryScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <MonthlySummaryTable pageRows={pagedRows} allRows={sortedRows} />
              </div>
              <div className="flex shrink-0 items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  แสดง {(currentSummaryPage - 1) * pageSize + 1}
                  {"-"}
                  {Math.min(currentSummaryPage * pageSize, sortedRows.length)} จาก{" "}
                  {sortedRows.length}
                </p>
                {summaryTotalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentSummaryPage === 1}
                      onClick={() => setSummaryPage(currentSummaryPage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: summaryTotalPages }, (_, i) => i + 1).map((pageNumber) => (
                      <Button
                        key={pageNumber}
                        size="sm"
                        variant={pageNumber === currentSummaryPage ? "default" : "outline"}
                        className={
                          pageNumber === currentSummaryPage
                            ? "bg-accent-600 text-white hover:bg-accent-700"
                            : undefined
                        }
                        onClick={() => setSummaryPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentSummaryPage === summaryTotalPages}
                      onClick={() => setSummaryPage(currentSummaryPage + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีข้อมูลของเดือนนี้</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

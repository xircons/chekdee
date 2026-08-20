import ExcelJS from "exceljs";

import {
  getDailyLogForEmployeeMonth,
  getMonthlyReportRows,
  type AttendanceStatus,
  type DailyLogRow,
  type MonthlyReportRow,
} from "@/lib/mock-data";

const LETTERHEAD = "Checkdee โดย turnPRO";
const DISCLAIMER =
  "รายงานนี้เป็นรายงานการเข้างานสำหรับใช้ภายในเท่านั้น ไม่ใช่เอกสารทางการของฝ่ายบุคคลหรือฝ่ายเงินเดือน";

const BRAND_TAB_ARGB = "FF1B4B91";
const BRAND_100_FILL_ARGB = "FFE8F0FC";
const WARNING_FILL_ARGB = "FFFFEDD5";
const DANGER_FILL_ARGB = "FFFEE2E2";
const SUCCESS_FILL_ARGB = "FFDCFCE7";
const SUCCESS_FONT_ARGB = "FF16A34A";
const WARNING_FONT_ARGB = "FFEA580C";
const DANGER_FONT_ARGB = "FFDC2626";
const MUTED_FONT_ARGB = "FF64748B";
const BORDER_ARGB = "FFE2E8F0";
const HYPERLINK_LABEL = "ไปที่ชีตพนักงาน";

const STATUS_LABEL_TH: Record<AttendanceStatus, string> = {
  present: "มาปกติ",
  สาย: "สาย",
  ขาด: "ขาด",
};

const THAI_MONTH_SHORT_TH = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

// Sheet tab names (and internal HYPERLINK targets that reference them) can't
// contain these characters and are capped at 31 chars. existingNames is
// mutated as names are minted so two employees whose names collide after
// sanitizing get distinct suffixes instead of silently overwriting one
// another's sheet.
const INVALID_SHEET_CHARS = /[:\\/?*[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

export function sanitizeSheetName(rawName: string, existingNames: Set<string>): string {
  const stripped = rawName.replace(INVALID_SHEET_CHARS, "").trim() || "Sheet";
  let candidate = stripped.slice(0, MAX_SHEET_NAME_LENGTH);
  let suffix = 1;
  while (existingNames.has(candidate)) {
    suffix += 1;
    const suffixText = ` (${suffix})`;
    candidate = stripped.slice(0, MAX_SHEET_NAME_LENGTH - suffixText.length) + suffixText;
  }
  existingNames.add(candidate);
  return candidate;
}

// "19 ส.ค. 2569 23:41 น." — Thai Buddhist calendar, matches the short-form
// date used on printed reports (as opposed to utils.ts's formatThaiDate,
// which spells the month out in full for on-screen headers).
function formatThaiTimestamp(date: Date): string {
  const day = date.getDate();
  const month = THAI_MONTH_SHORT_TH[date.getMonth()];
  const year = date.getFullYear() + 543;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hh}:${mm} น.`;
}

function formatTimeTh(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const REPORT_COLUMN_WIDTHS = [28, 16, 8, 16, 12, 14, 8, 8, 12];

// Column B carries the quick-lookup values, the dropdown's selected employee
// name (once picked), and the "ไปที่ชีตพนักงาน" hyperlink label - whichever
// of those is longest sets the width so nothing gets clipped.
function computeColumnBWidth(rows: MonthlyReportRow[]): number {
  const longestName = rows.reduce(
    (max, r) => Math.max(max, `${r.employee.firstName} ${r.employee.lastName}`.length),
    0
  );
  return Math.max(longestName, HYPERLINK_LABEL.length, 14) + 4;
}

// Thin border on all four sides of every cell in the rectangle, so the
// range reads as a boxed, gridlined section rather than being set off by
// blank rows alone.
function applyGridBorder(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      const border = { style: "thin" as const, color: { argb: BORDER_ARGB } };
      cell.border = { top: border, left: border, bottom: border, right: border };
    }
  }
}

function writeLetterhead(sheet: ExcelJS.Worksheet, generatedByName: string, now: Date) {
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = LETTERHEAD;
  titleCell.font = { bold: true, size: 14, color: { argb: BRAND_TAB_ARGB } };

  sheet.mergeCells("A2:I2");
  const disclaimerCell = sheet.getCell("A2");
  disclaimerCell.value = DISCLAIMER;
  disclaimerCell.font = { italic: true, size: 9, color: { argb: MUTED_FONT_ARGB } };

  sheet.mergeCells("A3:I3");
  const generatedCell = sheet.getCell("A3");
  generatedCell.value = `จัดทำเมื่อ ${formatThaiTimestamp(now)} โดย ${generatedByName} (ผู้ดูแลระบบ)`;
  generatedCell.font = { italic: true, size: 9, color: { argb: MUTED_FONT_ARGB } };
}

function styleTableHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_100_FILL_ARGB } };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_ARGB } } };
  });
}

function styleTotalsRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  });
}

// Reinforces the totals row's top edge after the uniform grid border has
// already been applied, so the row still reads as a distinct summary line
// (thicker, brand-colored) on top of the regular gridlines.
function emphasizeTotalsRowTopBorder(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = { ...cell.border, top: { style: "medium", color: { argb: BRAND_TAB_ARGB } } };
  });
}

function applyPrintSetup(sheet: ExcelJS.Worksheet) {
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

// Builds the "สรุป" sheet: letterhead, a quick per-employee lookup block fed
// by INDEX/MATCH formulas against the table below it, then the table itself
// (sorted worst-attendance-first) with a formula-driven totals row.
// Returns the row range of the table body so buildReportWorkbook can point
// each employee sheet's back-link and hyperlink targets at the right sheet.
function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  rows: MonthlyReportRow[],
  sheetNameByEmployeeId: Map<string, string>,
  generatedByName: string,
  now: Date
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("สรุป", {
    properties: { tabColor: { argb: BRAND_TAB_ARGB } },
  });
  const columnWidths = [...REPORT_COLUMN_WIDTHS];
  columnWidths[1] = computeColumnBWidth(rows);
  sheet.columns = columnWidths.map((width) => ({ width }));

  writeLetterhead(sheet, generatedByName, now);

  const LOOKUP_TITLE_ROW = 5;
  const LOOKUP_NAME_ROW = 6;
  const LOOKUP_LINK_ROW = 15;
  const TABLE_HEADER_ROW = 17;
  const TABLE_FIRST_DATA_ROW = TABLE_HEADER_ROW + 1;
  const tableLastDataRow = TABLE_FIRST_DATA_ROW + rows.length - 1;
  const totalsRowNumber = tableLastDataRow + 1;

  sheet.getCell(`A${LOOKUP_TITLE_ROW}`).value = "ดูสรุปรายคนแบบเร็ว";
  sheet.getCell(`A${LOOKUP_TITLE_ROW}`).font = { bold: true };

  const lookupFields: { label: string; column: string }[] = [
    { label: "รหัสนักศึกษา", column: "B" },
    { label: "รุ่น", column: "C" },
    { label: "จำนวนวันทำงาน", column: "D" },
    { label: "สาย (ครั้ง)", column: "E" },
    { label: "นาทีสายรวม", column: "F" },
    { label: "ขาด", column: "G" },
    { label: "ลา", column: "H" },
    { label: "ชั่วโมงรวม", column: "I" },
  ];

  sheet.getCell(`A${LOOKUP_NAME_ROW}`).value = "ชื่อ";
  const nameCellRef = `B${LOOKUP_NAME_ROW}`;
  const nameCellAbs = `$B$${LOOKUP_NAME_ROW}`;
  const nameCell = sheet.getCell(nameCellRef);
  nameCell.dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`$A$${TABLE_FIRST_DATA_ROW}:$A$${tableLastDataRow}`],
  };
  nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_100_FILL_ARGB } };

  lookupFields.forEach((field, i) => {
    const rowNumber = LOOKUP_NAME_ROW + 1 + i;
    sheet.getCell(`A${rowNumber}`).value = field.label;
    const formulaCell = sheet.getCell(`B${rowNumber}`);
    formulaCell.value = {
      formula: `IFERROR(INDEX($${field.column}$${TABLE_FIRST_DATA_ROW}:$${field.column}$${tableLastDataRow},MATCH(${nameCellAbs},$A$${TABLE_FIRST_DATA_ROW}:$A$${tableLastDataRow},0)),"-")`,
    };
  });

  sheet.getCell(`A${LOOKUP_LINK_ROW}`).value = "ลิงก์ไปยังชีตพนักงาน";
  // IFERROR alone won't catch this: with a blank name cell, MATCH fails and
  // HYPERLINK("#''!A1", ...) is still a syntactically valid formula that just
  // links nowhere useful, it doesn't raise an error IFERROR would catch. The
  // explicit blank check is what actually produces "-" on the empty state.
  sheet.getCell(`B${LOOKUP_LINK_ROW}`).value = {
    formula: `IF(${nameCellAbs}="","-",HYPERLINK("#'"&${nameCellAbs}&"'!A1","${HYPERLINK_LABEL}"))`,
  };

  const headerRow = sheet.getRow(TABLE_HEADER_ROW);
  headerRow.values = [
    "ชื่อ",
    "รหัสนักศึกษา",
    "รุ่น",
    "จำนวนวันทำงาน",
    "สาย (ครั้ง)",
    "นาทีสายรวม",
    "ขาด",
    "ลา",
    "ชั่วโมงรวม",
  ];
  styleTableHeaderRow(headerRow);

  rows.forEach((row, i) => {
    const sheetName = sheetNameByEmployeeId.get(row.employee.id) ?? "";
    const dataRow = sheet.getRow(TABLE_FIRST_DATA_ROW + i);
    dataRow.values = [
      sheetName,
      row.employee.studentId ?? "-",
      row.employee.studentGen ?? "-",
      row.workDays,
      row.lateCount,
      row.lateMinutes,
      row.absentCount,
      row.leaveDays,
      row.workedHours,
    ];
  });

  const totalsRow = sheet.getRow(totalsRowNumber);
  totalsRow.values = [
    "รวม",
    "-",
    "-",
    { formula: `SUM(D${TABLE_FIRST_DATA_ROW}:D${tableLastDataRow})` },
    { formula: `SUM(E${TABLE_FIRST_DATA_ROW}:E${tableLastDataRow})` },
    { formula: `SUM(F${TABLE_FIRST_DATA_ROW}:F${tableLastDataRow})` },
    { formula: `SUM(G${TABLE_FIRST_DATA_ROW}:G${tableLastDataRow})` },
    { formula: `SUM(H${TABLE_FIRST_DATA_ROW}:H${tableLastDataRow})` },
    { formula: `SUM(I${TABLE_FIRST_DATA_ROW}:I${tableLastDataRow})` },
  ];
  styleTotalsRow(totalsRow);

  applyGridBorder(sheet, TABLE_HEADER_ROW, totalsRowNumber, 1, 9);
  emphasizeTotalsRowTopBorder(totalsRow);
  applyGridBorder(sheet, LOOKUP_TITLE_ROW, LOOKUP_LINK_ROW, 1, 2);

  if (rows.length > 0) {
    // Two separate conditional-formatting blocks, each scoped to just its
    // own column, so a row tripping both conditions shows a red ขาด cell
    // next to an orange สาย cell instead of one color painted across the
    // whole row.
    sheet.addConditionalFormatting({
      ref: `G${TABLE_FIRST_DATA_ROW}:G${tableLastDataRow}`,
      rules: [
        {
          type: "expression",
          formulae: [`G${TABLE_FIRST_DATA_ROW}>0`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: DANGER_FILL_ARGB } } },
          priority: 1,
        },
      ],
    });
    sheet.addConditionalFormatting({
      ref: `E${TABLE_FIRST_DATA_ROW}:E${tableLastDataRow}`,
      rules: [
        {
          type: "expression",
          formulae: [`E${TABLE_FIRST_DATA_ROW}>0`],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: WARNING_FILL_ARGB } } },
          priority: 2,
        },
      ],
    });
  }

  sheet.views = [{ state: "frozen", ySplit: TABLE_HEADER_ROW }];
  applyPrintSetup(sheet);

  return sheet;
}

function statusFontArgb(status: AttendanceStatus | null): string | null {
  if (status === "present") return SUCCESS_FONT_ARGB;
  if (status === "สาย") return WARNING_FONT_ARGB;
  if (status === "ขาด") return DANGER_FONT_ARGB;
  return null;
}

function statusFillArgb(status: AttendanceStatus | null): string | null {
  if (status === "present") return SUCCESS_FILL_ARGB;
  if (status === "สาย") return WARNING_FILL_ARGB;
  if (status === "ขาด") return DANGER_FILL_ARGB;
  return null;
}

function buildEmployeeSheet(
  workbook: ExcelJS.Workbook,
  row: MonthlyReportRow,
  sheetName: string,
  dailyLog: DailyLogRow[],
  generatedByName: string,
  now: Date
) {
  const sheet = workbook.addWorksheet(sheetName);
  const fullNameLength = `${row.employee.firstName} ${row.employee.lastName}`.length;
  sheet.columns = [22, Math.max(fullNameLength + 4, 16), 14, 14, 30].map((width) => ({ width }));

  writeLetterhead(sheet, generatedByName, now);

  sheet.getCell("A5").value = {
    formula: `HYPERLINK("#'สรุป'!A1","กลับไปที่สรุป")`,
  };
  sheet.getCell("A5").font = { color: { argb: BRAND_TAB_ARGB }, underline: true };

  const infoFields: [string, string | number][] = [
    ["ชื่อ", `${row.employee.firstName} ${row.employee.lastName}`],
    ["รหัสนักศึกษา", row.employee.studentId ?? "-"],
    ["รุ่น", row.employee.studentGen ?? "-"],
    ["จำนวนวันทำงาน", row.workDays],
    ["สาย (ครั้ง)", row.lateCount],
    ["นาทีสายรวม", row.lateMinutes],
    ["ขาด", row.absentCount],
    ["ลา", row.leaveDays],
    ["ชั่วโมงรวม", row.workedHours],
  ];
  const INFO_FIRST_ROW = 7;
  infoFields.forEach(([label, value], i) => {
    const rowNumber = INFO_FIRST_ROW + i;
    sheet.getCell(`A${rowNumber}`).value = label;
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    sheet.getCell(`B${rowNumber}`).value = value;
  });

  const TABLE_HEADER_ROW = INFO_FIRST_ROW + infoFields.length + 2;
  const headerRow = sheet.getRow(TABLE_HEADER_ROW);
  headerRow.values = ["วันที่", "สถานะ", "เวลาเข้า", "เวลาออก", "หมายเหตุ"];
  styleTableHeaderRow(headerRow);

  dailyLog.forEach((log, i) => {
    const dataRow = sheet.getRow(TABLE_HEADER_ROW + 1 + i);
    dataRow.values = [
      log.date,
      log.status ? STATUS_LABEL_TH[log.status] : "-",
      formatTimeTh(log.checkInAt),
      formatTimeTh(log.checkOutAt),
      log.notes || "-",
    ];
    const statusCell = dataRow.getCell(2);
    const fillArgb = statusFillArgb(log.status);
    const fontArgb = statusFontArgb(log.status);
    if (fillArgb) statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
    if (fontArgb) statusCell.font = { color: { argb: fontArgb }, bold: true };
  });

  applyPrintSetup(sheet);
}

export async function buildReportWorkbook(
  yearMonth: string,
  generatedByName: string,
  now: Date = new Date()
): Promise<ExcelJS.Workbook> {
  const rows = [...getMonthlyReportRows(yearMonth)].sort((a, b) => b.absentCount - a.absentCount);

  const usedSheetNames = new Set<string>(["สรุป"]);
  const sheetNameByEmployeeId = new Map<string, string>();
  for (const row of rows) {
    const fullName = `${row.employee.firstName} ${row.employee.lastName}`;
    sheetNameByEmployeeId.set(row.employee.id, sanitizeSheetName(fullName, usedSheetNames));
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = generatedByName;
  workbook.created = now;

  buildSummarySheet(workbook, rows, sheetNameByEmployeeId, generatedByName, now);

  for (const row of rows) {
    const sheetName = sheetNameByEmployeeId.get(row.employee.id);
    if (!sheetName) continue;
    const dailyLog = getDailyLogForEmployeeMonth(row.employee.id, yearMonth);
    buildEmployeeSheet(workbook, row, sheetName, dailyLog, generatedByName, now);
  }

  return workbook;
}

export async function downloadReportWorkbook(yearMonth: string, generatedByName: string): Promise<void> {
  const workbook = await buildReportWorkbook(yearMonth, generatedByName);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `รายงานการเข้างาน-${yearMonth}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

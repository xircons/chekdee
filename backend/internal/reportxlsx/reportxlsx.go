// Package reportxlsx builds the monthly attendance Excel export. This is a
// functional, cleanly-formatted two-sheet workbook (summary + daily detail)
// — not a byte-for-byte port of the frontend's existing exceljs-based
// export (frontend/src/lib/report-export.ts), which has per-cell
// conditional formatting, INDEX/MATCH quick-lookup formulas, and
// per-employee sheets with hyperlink navigation. That level of polish is
// presentation logic more naturally owned by the frontend; PR 10 decides
// whether to keep the client-side generator or switch to downloading this
// file. What matters here is that the backend can produce a real workbook
// asynchronously from a river job, per PLAN.md's PR 7 scope.
package reportxlsx

import (
	"bytes"
	"fmt"

	"github.com/xuri/excelize/v2"

	"checkdee-backend/internal/domain"
)

const (
	summarySheet = "สรุป"
	dailySheet   = "รายละเอียดรายวัน"
)

var statusLabelTH = map[domain.AttendanceStatus]string{
	domain.AttendanceStatusPresent: "มาปกติ",
	domain.AttendanceStatusLate:    "สาย",
	domain.AttendanceStatusAbsent:  "ขาด",
	domain.AttendanceStatusPending: "-",
}

func employeeName(firstName, lastName *string) string {
	first, last := "", ""
	if firstName != nil {
		first = *firstName
	}
	if lastName != nil {
		last = *lastName
	}
	name := first + " " + last
	if name == " " {
		return "-"
	}
	return name
}

// Build renders the monthly report + daily log into an .xlsx file.
func Build(month string, rows []domain.MonthlyReportRow, dailyLog []domain.DailyLogRow) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close() //nolint:errcheck

	if err := buildSummarySheet(f, month, rows); err != nil {
		return nil, err
	}
	if err := buildDailySheet(f, dailyLog); err != nil {
		return nil, err
	}

	if err := f.DeleteSheet("Sheet1"); err != nil {
		return nil, err
	}
	f.SetActiveSheet(0)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func headerStyle(f *excelize.File) (int, error) {
	return f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#E8F0FC"}},
	})
}

func buildSummarySheet(f *excelize.File, month string, rows []domain.MonthlyReportRow) error {
	if _, err := f.NewSheet(summarySheet); err != nil {
		return err
	}

	if err := f.SetCellValue(summarySheet, "A1", fmt.Sprintf("รายงานการเข้างานประจำเดือน %s", month)); err != nil {
		return err
	}

	headers := []string{"ชื่อ", "จำนวนวันทำงาน", "สาย (ครั้ง)", "นาทีสายรวม", "ขาด", "ลา", "ชั่วโมงรวม"}
	headerRow := 3
	for col, h := range headers {
		cell, err := excelize.CoordinatesToCellName(col+1, headerRow)
		if err != nil {
			return err
		}
		if err := f.SetCellValue(summarySheet, cell, h); err != nil {
			return err
		}
	}
	style, err := headerStyle(f)
	if err != nil {
		return err
	}
	endCell, err := excelize.CoordinatesToCellName(len(headers), headerRow)
	if err != nil {
		return err
	}
	if err := f.SetCellStyle(summarySheet, "A3", endCell, style); err != nil {
		return err
	}

	for i, row := range rows {
		r := headerRow + 1 + i
		values := []any{
			employeeName(row.FirstName, row.LastName),
			row.WorkDays, row.LateCount, row.LateMinutes, row.AbsentCount, row.LeaveDays, row.WorkedHours,
		}
		for col, v := range values {
			cell, err := excelize.CoordinatesToCellName(col+1, r)
			if err != nil {
				return err
			}
			if err := f.SetCellValue(summarySheet, cell, v); err != nil {
				return err
			}
		}
	}

	for col := 1; col <= len(headers); col++ {
		colName, err := excelize.ColumnNumberToName(col)
		if err != nil {
			return err
		}
		if err := f.SetColWidth(summarySheet, colName, colName, 16); err != nil {
			return err
		}
	}
	return nil
}

func buildDailySheet(f *excelize.File, rows []domain.DailyLogRow) error {
	if _, err := f.NewSheet(dailySheet); err != nil {
		return err
	}

	headers := []string{"วันที่", "ชื่อ", "สถานะ", "เวลาเข้า", "เวลาออก", "หมายเหตุ"}
	for col, h := range headers {
		cell, err := excelize.CoordinatesToCellName(col+1, 1)
		if err != nil {
			return err
		}
		if err := f.SetCellValue(dailySheet, cell, h); err != nil {
			return err
		}
	}
	style, err := headerStyle(f)
	if err != nil {
		return err
	}
	endCell, err := excelize.CoordinatesToCellName(len(headers), 1)
	if err != nil {
		return err
	}
	if err := f.SetCellStyle(dailySheet, "A1", endCell, style); err != nil {
		return err
	}

	for i, row := range rows {
		r := 2 + i
		checkIn, checkOut := "-", "-"
		if row.CheckInAt != nil {
			checkIn = row.CheckInAt.Format("15:04:05")
		}
		if row.CheckOutAt != nil {
			checkOut = row.CheckOutAt.Format("15:04:05")
		}
		notes := ""
		if row.AutoClosed {
			notes = "ปิดงานอัตโนมัติ (ไม่ได้เช็คเอาท์)"
		}

		values := []any{
			row.Date.Format("2006-01-02"),
			employeeName(row.FirstName, row.LastName),
			statusLabelTH[row.Status],
			checkIn, checkOut, notes,
		}
		for col, v := range values {
			cell, err := excelize.CoordinatesToCellName(col+1, r)
			if err != nil {
				return err
			}
			if err := f.SetCellValue(dailySheet, cell, v); err != nil {
				return err
			}
		}
	}

	for col := 1; col <= len(headers); col++ {
		colName, err := excelize.ColumnNumberToName(col)
		if err != nil {
			return err
		}
		if err := f.SetColWidth(dailySheet, colName, colName, 18); err != nil {
			return err
		}
	}
	return nil
}

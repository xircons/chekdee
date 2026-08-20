package reportxlsx_test

import (
	"bytes"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/reportxlsx"
)

func TestBuild_ProducesReadableWorkbook(t *testing.T) {
	first, last := "Somchai", "Testcase"
	checkIn := time.Date(2026, 3, 2, 9, 0, 0, 0, time.UTC)
	checkOut := time.Date(2026, 3, 2, 17, 0, 0, 0, time.UTC)

	rows := []domain.MonthlyReportRow{
		{EmployeeID: "e1", FirstName: &first, LastName: &last, WorkDays: 20, LateCount: 2, LateMinutes: 45, AbsentCount: 1, LeaveDays: 1, WorkedHours: 160.5},
	}
	dailyLog := []domain.DailyLogRow{
		{Date: time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC), EmployeeID: "e1", FirstName: &first, LastName: &last, Status: domain.AttendanceStatusPresent, CheckInAt: &checkIn, CheckOutAt: &checkOut},
	}

	data, err := reportxlsx.Build("2026-03", rows, dailyLog)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	f, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer f.Close()

	sheets := f.GetSheetList()
	require.Contains(t, sheets, "สรุป")
	require.Contains(t, sheets, "รายละเอียดรายวัน")
	require.NotContains(t, sheets, "Sheet1")

	name, err := f.GetCellValue("สรุป", "A4")
	require.NoError(t, err)
	require.Equal(t, "Somchai Testcase", name)

	status, err := f.GetCellValue("รายละเอียดรายวัน", "C2")
	require.NoError(t, err)
	require.Equal(t, "มาปกติ", status)
}

func TestBuild_EmptyRows(t *testing.T) {
	data, err := reportxlsx.Build("2026-03", nil, nil)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	f, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer f.Close()
	require.Contains(t, f.GetSheetList(), "สรุป")
}

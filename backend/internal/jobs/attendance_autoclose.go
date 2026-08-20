package jobs

import (
	"context"
	"fmt"
	"time"

	"github.com/riverqueue/river"

	"checkdee-backend/internal/domain"
)

type AttendanceAutoCloseArgs struct{}

func (AttendanceAutoCloseArgs) Kind() string { return "attendance_auto_close" }

// AttendanceAutoCloseWorker closes yesterday-or-earlier attendance records
// that have a check-in but no check-out, so a forgotten checkout never
// blocks the employee's next check-in (the (employee_id, work_date) unique
// constraint on attendance_records would otherwise leave today's row
// permanently unusable once a schedule change or long shift straddles
// midnight without an explicit checkout).
type AttendanceAutoCloseWorker struct {
	river.WorkerDefaults[AttendanceAutoCloseArgs]
	attendance domain.AttendanceRepository
}

func NewAttendanceAutoCloseWorker(attendance domain.AttendanceRepository) *AttendanceAutoCloseWorker {
	return &AttendanceAutoCloseWorker{attendance: attendance}
}

func (w *AttendanceAutoCloseWorker) Work(ctx context.Context, job *river.Job[AttendanceAutoCloseArgs]) error {
	cutoff := bangkokToday()
	if _, err := w.attendance.AutoCloseOpenRecords(ctx, cutoff); err != nil {
		return fmt.Errorf("attendance auto-close: %w", err)
	}
	return nil
}

func bangkokToday() time.Time {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		loc = time.FixedZone("Asia/Bangkok", 7*60*60)
	}
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

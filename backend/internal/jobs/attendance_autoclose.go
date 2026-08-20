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
// midnight without an explicit checkout). Also notifies each affected
// employee — PR 9's first attendance-event notification.
type AttendanceAutoCloseWorker struct {
	river.WorkerDefaults[AttendanceAutoCloseArgs]
	attendance    domain.AttendanceRepository
	notifications domain.NotificationRepository
}

func NewAttendanceAutoCloseWorker(attendance domain.AttendanceRepository, notifications domain.NotificationRepository) *AttendanceAutoCloseWorker {
	return &AttendanceAutoCloseWorker{attendance: attendance, notifications: notifications}
}

func (w *AttendanceAutoCloseWorker) Work(ctx context.Context, job *river.Job[AttendanceAutoCloseArgs]) error {
	cutoff := bangkokToday()
	closed, err := w.attendance.AutoCloseOpenRecords(ctx, cutoff)
	if err != nil {
		return fmt.Errorf("attendance auto-close: %w", err)
	}

	for _, rec := range closed {
		workDate := rec.WorkDate.Format("2006-01-02")
		body := fmt.Sprintf("ระบบปิดงานวันที่ %s ให้อัตโนมัติเนื่องจากไม่พบการเช็คเอาท์ หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ", workDate)
		if err := w.notifications.Create(ctx, rec.EmployeeID, "attendance.auto_closed", "ระบบปิดงานอัตโนมัติ", &body, map[string]string{
			"attendance_record_id": rec.ID,
			"work_date":            workDate,
		}); err != nil {
			// A notification-write failure must not fail the whole batch —
			// the auto-close itself already committed for every record, so
			// losing one notification is a lesser failure than retrying
			// (and re-notifying) the entire already-successful auto-close.
			continue
		}
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

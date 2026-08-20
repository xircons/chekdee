package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrAlreadyCheckedIn  = errors.New("employee already checked in today")
	ErrNotCheckedIn      = errors.New("employee has not checked in today")
	ErrAlreadyCheckedOut = errors.New("employee already checked out today")
)

// AttendanceStatus uses English codes, not the frontend's Thai labels — see
// the 000003 migration comment. late/absent thresholds: 0 minutes late or
// earlier is present, up to 60 minutes late is late, over 60 minutes late
// (or scanning in without ever having shown up) is absent — no grace
// period, matching the frontend's already-shipped computeAttendanceStatus.
type AttendanceStatus string

const (
	AttendanceStatusPending AttendanceStatus = "pending"
	AttendanceStatusPresent AttendanceStatus = "present"
	AttendanceStatusLate    AttendanceStatus = "late"
	AttendanceStatusAbsent  AttendanceStatus = "absent"
)

type AttendanceRecord struct {
	ID         string
	EmployeeID string
	WorkDate   time.Time
	CheckInAt  *time.Time
	CheckOutAt *time.Time
	Status     AttendanceStatus
	AutoClosed bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type AttendanceRepository interface {
	GetForEmployeeDate(ctx context.Context, employeeID string, workDate time.Time) (*AttendanceRecord, error)
	// GetByIdempotencyKey looks up a previously-completed check-in/out by
	// key, returning (nil, nil) on a fresh key. The CheckIn usecase calls
	// this before touching the QR nonce, so a retried submit short-circuits
	// before any side effect that a second attempt can't safely repeat.
	GetByIdempotencyKey(ctx context.Context, idempotencyKey string) (*AttendanceRecord, error)
	// CheckIn is idempotent on idempotencyKey: a retried submit with the same
	// key returns the first attempt's record without reprocessing. A new key
	// against an employee/date that already has a check-in returns
	// ErrAlreadyCheckedIn.
	CheckIn(ctx context.Context, employeeID string, workDate, checkInAt time.Time, status AttendanceStatus, idempotencyKey string) (*AttendanceRecord, error)
	// CheckOut is idempotent the same way. Returns ErrNotCheckedIn if there
	// is no check-in yet, ErrAlreadyCheckedOut if one is already recorded.
	CheckOut(ctx context.Context, employeeID string, workDate, checkOutAt time.Time, idempotencyKey string) (*AttendanceRecord, error)
	// AutoCloseOpenRecords closes every record with a check-in but no
	// check-out whose work_date is before cutoff, setting check_out_at to
	// the end of that work_date (Asia/Bangkok) and auto_closed = true.
	// Returns the closed records (PR 9's auto-close worker notifies each
	// affected employee). Precise worked-hours capping to the scheduled
	// window is a Reports (PR 7) concern, not this job's.
	AutoCloseOpenRecords(ctx context.Context, cutoff time.Time) ([]*AttendanceRecord, error)
	// ListForMonth returns every attendance record (all employees) with
	// work_date in [from, to) — the report queries' data source.
	ListForMonth(ctx context.Context, from, to time.Time) ([]*AttendanceRecord, error)
}

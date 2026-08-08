package domain

import (
	"context"
	"errors"
	"time"
)

type AttendanceStatus string

const (
	AttendanceStatusPresent AttendanceStatus = "present"
	AttendanceStatusLate    AttendanceStatus = "สาย"
	AttendanceStatusAbsent  AttendanceStatus = "ขาด"
)

var ErrAttendanceRecordNotFound = errors.New("attendance record not found")

type AttendanceRecord struct {
	ID         string
	EmployeeID string
	WorkDate   time.Time

	CheckInAt        *time.Time
	CheckInLat       *float64
	CheckInLng       *float64
	CheckInAccuracyM *float64

	CheckOutAt *time.Time

	Status     *AttendanceStatus
	AutoClosed bool

	CreatedAt time.Time
	UpdatedAt time.Time
}

type AttendanceCorrection struct {
	ID                 string
	AttendanceRecordID string
	CorrectedBy        string
	FieldName          string
	OldValue           *string
	NewValue           *string
	Reason             *string
	CreatedAt          time.Time
}

type AttendanceRepository interface {
	CreateCheckIn(ctx context.Context, r *AttendanceRecord) (*AttendanceRecord, error)
	GetByEmployeeAndDate(ctx context.Context, employeeID string, workDate time.Time) (*AttendanceRecord, error)
	SetCheckOut(ctx context.Context, id string, checkOutAt time.Time) (*AttendanceRecord, error)
	AutoClose(ctx context.Context, id string, checkOutAt time.Time) (*AttendanceRecord, error)
	// ListOpenBefore returns records with no checkout for work_date < before
	// — used by the end-of-day auto-close job.
	ListOpenBefore(ctx context.Context, before time.Time) ([]*AttendanceRecord, error)

	CreateCorrection(ctx context.Context, c *AttendanceCorrection) (*AttendanceCorrection, error)
	ListCorrectionsForRecord(ctx context.Context, attendanceRecordID string) ([]*AttendanceCorrection, error)
}

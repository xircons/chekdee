package domain

import (
	"context"
	"errors"
	"time"
)

var ErrReportExportNotFound = errors.New("report export not found")

// MonthlyReportRow mirrors the frontend's already-shipped MonthlyReportRow
// shape (frontend/src/lib/mock-data.ts) — one row per employee for a given
// month. WorkedHours applies the same no-overtime cap the rest of the
// codebase assumes: never counts time outside the scheduled window, even
// with a real late checkout.
type MonthlyReportRow struct {
	EmployeeID  string
	FirstName   *string
	LastName    *string
	WorkDays    int
	LateCount   int
	LateMinutes int
	AbsentCount int
	LeaveDays   int
	WorkedHours float64
}

// DailyLogRow is the long-format per-record row backing the export's daily
// detail sheet and the admin's calendar-heatmap view.
type DailyLogRow struct {
	Date       time.Time
	EmployeeID string
	FirstName  *string
	LastName   *string
	Status     AttendanceStatus
	CheckInAt  *time.Time
	CheckOutAt *time.Time
	AutoClosed bool
}

type ReportExportStatus string

const (
	ReportExportStatusProcessing ReportExportStatus = "processing"
	ReportExportStatusReady      ReportExportStatus = "ready"
	ReportExportStatusFailed     ReportExportStatus = "failed"
)

type ReportExport struct {
	ID          string
	RequestedBy string
	Month       string
	Status      ReportExportStatus
	File        []byte
	Error       *string
	CreatedAt   time.Time
	CompletedAt *time.Time
}

type ReportExportRepository interface {
	Create(ctx context.Context, requestedBy, month string) (*ReportExport, error)
	Get(ctx context.Context, id string) (*ReportExport, error)
	MarkReady(ctx context.Context, id string, file []byte) error
	MarkFailed(ctx context.Context, id string, errMsg string) error
}

// ReportRepository is a report-specific read against leave_requests — not a
// general leave management repository (that's PR 8's job). Approved-leave
// day counts feed MonthlyReportRow.LeaveDays.
type ReportRepository interface {
	// ApprovedLeaveDaysByEmployee returns, for every employee with at least
	// one approved leave request overlapping [from, to], the number of days
	// of that overlap (clipped to the range, inclusive).
	ApprovedLeaveDaysByEmployee(ctx context.Context, from, to time.Time) (map[string]int, error)
}

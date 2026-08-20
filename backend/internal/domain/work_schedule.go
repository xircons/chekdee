package domain

import (
	"context"
	"time"
)

type WorkSchedule struct {
	ID            string
	EmployeeID    string
	DayOfWeek     int16 // 0 = Sunday
	StartTime     time.Time
	EndTime       time.Time
	EffectiveFrom time.Time
	EffectiveTo   *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type WorkScheduleRepository interface {
	ListForEmployee(ctx context.Context, employeeID string) ([]*WorkSchedule, error)
	// ReplaceForEmployee atomically deletes every existing row for the
	// employee and inserts rows, matching the frontend's replace-by-employee
	// semantics for both the single-employee editor and CSV import. The
	// EXCLUDE constraint on work_schedules still applies within the new set,
	// so a caller passing two overlapping day/date ranges gets a clear DB
	// error rather than silently-accepted bad data.
	ReplaceForEmployee(ctx context.Context, employeeID string, rows []*WorkSchedule) ([]*WorkSchedule, error)
}

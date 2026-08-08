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
	Create(ctx context.Context, ws *WorkSchedule) (*WorkSchedule, error)
	ListForEmployee(ctx context.Context, employeeID string) ([]*WorkSchedule, error)
	Delete(ctx context.Context, id string) error
}

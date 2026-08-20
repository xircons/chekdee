package usecase

import (
	"context"

	"checkdee-backend/internal/domain"
)

type ScheduleUsecase struct {
	schedules domain.WorkScheduleRepository
}

func NewScheduleUsecase(schedules domain.WorkScheduleRepository) *ScheduleUsecase {
	return &ScheduleUsecase{schedules: schedules}
}

func (s *ScheduleUsecase) ListForEmployee(ctx context.Context, employeeID string) ([]*domain.WorkSchedule, error) {
	return s.schedules.ListForEmployee(ctx, employeeID)
}

// Replace applies the admin schedule editor's (and CSV import's)
// replace-by-employee semantics: the employee's whole schedule is swapped
// for the given rows in one transaction.
func (s *ScheduleUsecase) Replace(ctx context.Context, employeeID string, rows []*domain.WorkSchedule) ([]*domain.WorkSchedule, error) {
	return s.schedules.ReplaceForEmployee(ctx, employeeID, rows)
}

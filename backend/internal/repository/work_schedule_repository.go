package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository/sqlcgen"
)

type WorkScheduleRepository struct {
	q *sqlcgen.Queries
}

func NewWorkScheduleRepository(pool *pgxpool.Pool) *WorkScheduleRepository {
	return &WorkScheduleRepository{q: sqlcgen.New(pool)}
}

func toWorkSchedule(w sqlcgen.WorkSchedule) *domain.WorkSchedule {
	return &domain.WorkSchedule{
		ID:            uuidToString(w.ID),
		EmployeeID:    uuidToString(w.EmployeeID),
		DayOfWeek:     w.DayOfWeek,
		StartTime:     pgtypeToTimeOfDay(w.StartTime),
		EndTime:       pgtypeToTimeOfDay(w.EndTime),
		EffectiveFrom: dateToTime(w.EffectiveFrom),
		EffectiveTo:   dateToTimePtr(w.EffectiveTo),
		CreatedAt:     timestamptzToTime(w.CreatedAt),
		UpdatedAt:     timestamptzToTime(w.UpdatedAt),
	}
}

func (r *WorkScheduleRepository) Create(ctx context.Context, ws *domain.WorkSchedule) (*domain.WorkSchedule, error) {
	row, err := r.q.CreateWorkSchedule(ctx, sqlcgen.CreateWorkScheduleParams{
		EmployeeID:    stringToUUID(ws.EmployeeID),
		DayOfWeek:     ws.DayOfWeek,
		StartTime:     timeOfDayToPgtype(ws.StartTime),
		EndTime:       timeOfDayToPgtype(ws.EndTime),
		EffectiveFrom: timeToDate(ws.EffectiveFrom),
		EffectiveTo:   timePtrToDate(ws.EffectiveTo),
	})
	if err != nil {
		return nil, err
	}
	return toWorkSchedule(row), nil
}

func (r *WorkScheduleRepository) ListForEmployee(ctx context.Context, employeeID string) ([]*domain.WorkSchedule, error) {
	rows, err := r.q.ListWorkSchedulesForEmployee(ctx, stringToUUID(employeeID))
	if err != nil {
		return nil, err
	}
	out := make([]*domain.WorkSchedule, 0, len(rows))
	for _, row := range rows {
		out = append(out, toWorkSchedule(row))
	}
	return out, nil
}

func (r *WorkScheduleRepository) Delete(ctx context.Context, id string) error {
	return r.q.DeleteWorkSchedule(ctx, stringToUUID(id))
}

package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type WorkScheduleRepository struct {
	pool *pgxpool.Pool
}

func NewWorkScheduleRepository(pool *pgxpool.Pool) *WorkScheduleRepository {
	return &WorkScheduleRepository{pool: pool}
}

const workScheduleColumns = `
	id::text, employee_id::text, day_of_week, start_time, end_time,
	effective_from, effective_to, created_at, updated_at`

func scanWorkSchedule(row pgx.Row) (*domain.WorkSchedule, error) {
	var ws domain.WorkSchedule
	err := row.Scan(
		&ws.ID, &ws.EmployeeID, &ws.DayOfWeek, &ws.StartTime, &ws.EndTime,
		&ws.EffectiveFrom, &ws.EffectiveTo, &ws.CreatedAt, &ws.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ws, nil
}

func (r *WorkScheduleRepository) ListForEmployee(ctx context.Context, employeeID string) ([]*domain.WorkSchedule, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+workScheduleColumns+`
		FROM work_schedules
		WHERE employee_id = $1
		ORDER BY day_of_week, start_time`,
		employeeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.WorkSchedule
	for rows.Next() {
		ws, err := scanWorkSchedule(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, ws)
	}
	return out, rows.Err()
}

// ReplaceForEmployee deletes every existing row for the employee and inserts
// the new set in one transaction: either the whole replace lands, or none of
// it does, so a bad new set (e.g. one that would violate the overlap
// EXCLUDE constraint) never leaves the employee with a half-updated
// schedule.
func (r *WorkScheduleRepository) ReplaceForEmployee(ctx context.Context, employeeID string, rows []*domain.WorkSchedule) ([]*domain.WorkSchedule, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `DELETE FROM work_schedules WHERE employee_id = $1`, employeeID); err != nil {
		return nil, err
	}

	out := make([]*domain.WorkSchedule, 0, len(rows))
	for _, ws := range rows {
		row := tx.QueryRow(ctx, `
			INSERT INTO work_schedules (employee_id, day_of_week, start_time, end_time, effective_from, effective_to)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING `+workScheduleColumns,
			employeeID, ws.DayOfWeek, ws.StartTime, ws.EndTime, ws.EffectiveFrom, ws.EffectiveTo,
		)
		inserted, err := scanWorkSchedule(row)
		if err != nil {
			return nil, err
		}
		out = append(out, inserted)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

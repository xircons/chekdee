package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

func mustTime(t *testing.T, layout, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(layout, value)
	require.NoError(t, err)
	return parsed
}

func TestWorkScheduleRepository_ReplaceForEmployee(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	schedules := repository.NewWorkScheduleRepository(pool)
	ctx := context.Background()

	lineUserID := "test-schedule-employee-" + time.Now().Format("20060102150405.000000000")
	employee, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Schedule Test", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM work_schedules WHERE employee_id = $1", employee.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", employee.ID)
	})

	monday := &domain.WorkSchedule{
		DayOfWeek:     1,
		StartTime:     mustTime(t, "15:04:05", "09:00:00"),
		EndTime:       mustTime(t, "15:04:05", "17:00:00"),
		EffectiveFrom: mustTime(t, "2006-01-02", "2026-01-01"),
	}
	tuesday := &domain.WorkSchedule{
		DayOfWeek:     2,
		StartTime:     mustTime(t, "15:04:05", "09:00:00"),
		EndTime:       mustTime(t, "15:04:05", "17:00:00"),
		EffectiveFrom: mustTime(t, "2006-01-02", "2026-01-01"),
	}

	created, err := schedules.ReplaceForEmployee(ctx, employee.ID, []*domain.WorkSchedule{monday, tuesday})
	require.NoError(t, err)
	require.Len(t, created, 2)

	list, err := schedules.ListForEmployee(ctx, employee.ID)
	require.NoError(t, err)
	require.Len(t, list, 2)

	// Replace again with a single row — the old two rows must be gone, not
	// just appended to.
	wednesday := &domain.WorkSchedule{
		DayOfWeek:     3,
		StartTime:     mustTime(t, "15:04:05", "10:00:00"),
		EndTime:       mustTime(t, "15:04:05", "18:00:00"),
		EffectiveFrom: mustTime(t, "2006-01-02", "2026-01-01"),
	}
	replaced, err := schedules.ReplaceForEmployee(ctx, employee.ID, []*domain.WorkSchedule{wednesday})
	require.NoError(t, err)
	require.Len(t, replaced, 1)

	list, err = schedules.ListForEmployee(ctx, employee.ID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.EqualValues(t, 3, list[0].DayOfWeek)
}

func TestWorkScheduleRepository_ReplaceForEmployee_RejectsOverlap(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	schedules := repository.NewWorkScheduleRepository(pool)
	ctx := context.Background()

	lineUserID := "test-schedule-overlap-" + time.Now().Format("20060102150405.000000000")
	employee, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Overlap Test", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM work_schedules WHERE employee_id = $1", employee.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", employee.ID)
	})

	// Two rows for the same weekday with overlapping effective-date ranges
	// must be rejected by the DB's EXCLUDE constraint, and the whole
	// transaction must roll back (no partial write).
	rowA := &domain.WorkSchedule{
		DayOfWeek:     1,
		StartTime:     mustTime(t, "15:04:05", "09:00:00"),
		EndTime:       mustTime(t, "15:04:05", "12:00:00"),
		EffectiveFrom: mustTime(t, "2006-01-02", "2026-01-01"),
	}
	rowB := &domain.WorkSchedule{
		DayOfWeek:     1,
		StartTime:     mustTime(t, "15:04:05", "13:00:00"),
		EndTime:       mustTime(t, "15:04:05", "17:00:00"),
		EffectiveFrom: mustTime(t, "2006-01-02", "2026-06-01"),
	}

	_, err = schedules.ReplaceForEmployee(ctx, employee.ID, []*domain.WorkSchedule{rowA, rowB})
	require.Error(t, err)

	list, err := schedules.ListForEmployee(ctx, employee.ID)
	require.NoError(t, err)
	require.Empty(t, list, "a rejected replace must not leave a partial write")
}

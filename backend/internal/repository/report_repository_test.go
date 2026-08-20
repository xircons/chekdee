package repository_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/repository"
)

func TestReportRepository_ApprovedLeaveDaysByEmployee(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-report-leave")
	reports := repository.NewReportRepository(pool)
	ctx := context.Background()

	// Approved leave fully inside March: 5 days (Mar 10-14 inclusive).
	_, err = pool.Exec(ctx, `
		INSERT INTO leave_requests (employee_id, start_date, end_date, status)
		VALUES ($1, '2026-03-10', '2026-03-14', 'approved')`,
		employee.ID,
	)
	require.NoError(t, err)
	// Pending leave must not count.
	_, err = pool.Exec(ctx, `
		INSERT INTO leave_requests (employee_id, start_date, end_date, status)
		VALUES ($1, '2026-03-20', '2026-03-21', 'pending')`,
		employee.ID,
	)
	require.NoError(t, err)
	// Approved leave spanning the month boundary: only the March portion
	// (Mar 30-31 = 2 days) counts for March.
	_, err = pool.Exec(ctx, `
		INSERT INTO leave_requests (employee_id, start_date, end_date, status)
		VALUES ($1, '2026-03-30', '2026-04-02', 'approved')`,
		employee.ID,
	)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM leave_requests WHERE employee_id = $1", employee.ID)
	})

	from := mustTime(t, "2006-01-02", "2026-03-01")
	to := mustTime(t, "2006-01-02", "2026-04-01") // exclusive

	days, err := reports.ApprovedLeaveDaysByEmployee(ctx, from, to)
	require.NoError(t, err)
	require.Equal(t, 5+2, days[employee.ID], "5 days fully inside March, plus 2 days from the boundary-spanning request")
}

func TestReportRepository_ApprovedLeaveDaysByEmployee_NoApprovedLeave(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	reports := repository.NewReportRepository(pool)
	from := mustTime(t, "2006-01-02", "2026-03-01")
	to := mustTime(t, "2006-01-02", "2026-04-01")

	days, err := reports.ApprovedLeaveDaysByEmployee(context.Background(), from, to)
	require.NoError(t, err)
	require.Empty(t, days)
}

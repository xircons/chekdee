package repository_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

func TestLeaveRequestRepository_CreateGetListForEmployee(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-leave-employee")
	leaves := repository.NewLeaveRequestRepository(pool)
	ctx := context.Background()
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM leave_requests WHERE employee_id = $1", employee.ID)
	})

	leaveType := "ลาป่วย"
	reason := "ไม่สบาย"
	start := mustTime(t, "2006-01-02", "2026-06-01")
	end := mustTime(t, "2006-01-02", "2026-06-03")

	created, err := leaves.Create(ctx, employee.ID, &leaveType, &reason, start, end)
	require.NoError(t, err)
	require.Equal(t, domain.LeaveStatusPending, created.Status)
	require.Equal(t, "ลาป่วย", *created.LeaveType)

	fetched, err := leaves.Get(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, created.ID, fetched.ID)

	list, err := leaves.ListForEmployee(ctx, employee.ID)
	require.NoError(t, err)
	require.Len(t, list, 1)
}

func TestLeaveRequestRepository_ListAll_PendingSortedFirst(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-leave-sort-employee")
	admin := newTestEmployee(t, pool, "test-leave-sort-admin")
	leaves := repository.NewLeaveRequestRepository(pool)
	ctx := context.Background()
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM leave_requests WHERE employee_id = $1", employee.ID)
	})

	// Decided first (older), pending second (newer) — pending must still
	// sort first regardless of created_at.
	decided, err := leaves.Create(ctx, employee.ID, nil, nil, mustTime(t, "2006-01-02", "2026-01-01"), mustTime(t, "2006-01-02", "2026-01-02"))
	require.NoError(t, err)
	_, err = leaves.Decide(ctx, decided.ID, domain.LeaveStatusApproved, admin.ID, "127.0.0.1")
	require.NoError(t, err)

	pending, err := leaves.Create(ctx, employee.ID, nil, nil, mustTime(t, "2006-01-02", "2026-02-01"), mustTime(t, "2006-01-02", "2026-02-02"))
	require.NoError(t, err)

	all, err := leaves.ListAll(ctx)
	require.NoError(t, err)

	var pendingIdx, decidedIdx = -1, -1
	for i, l := range all {
		if l.ID == pending.ID {
			pendingIdx = i
		}
		if l.ID == decided.ID {
			decidedIdx = i
		}
	}
	require.NotEqual(t, -1, pendingIdx)
	require.NotEqual(t, -1, decidedIdx)
	require.Less(t, pendingIdx, decidedIdx, "pending requests must sort before decided ones")
}

func TestLeaveRequestRepository_Decide_RejectsSecondDecision(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-leave-decide-employee")
	admin := newTestEmployee(t, pool, "test-leave-decide-admin")
	leaves := repository.NewLeaveRequestRepository(pool)
	ctx := context.Background()
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM leave_requests WHERE employee_id = $1", employee.ID)
	})

	created, err := leaves.Create(ctx, employee.ID, nil, nil, mustTime(t, "2006-01-02", "2026-07-01"), mustTime(t, "2006-01-02", "2026-07-02"))
	require.NoError(t, err)

	approved, err := leaves.Decide(ctx, created.ID, domain.LeaveStatusApproved, admin.ID, "127.0.0.1")
	require.NoError(t, err)
	require.Equal(t, domain.LeaveStatusApproved, approved.Status)
	require.NotNil(t, approved.DecidedAt)
	require.Equal(t, admin.ID, *approved.DecidedBy)

	_, err = leaves.Decide(ctx, created.ID, domain.LeaveStatusRejected, admin.ID, "127.0.0.1")
	require.ErrorIs(t, err, domain.ErrLeaveRequestAlreadyDecided, "a decision must be final — no re-deciding")
}

func TestLeaveRequestRepository_Decide_NotFound(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	leaves := repository.NewLeaveRequestRepository(pool)
	_, err = leaves.Decide(context.Background(), "00000000-0000-0000-0000-000000000000", domain.LeaveStatusApproved, "00000000-0000-0000-0000-000000000000", "127.0.0.1")
	require.ErrorIs(t, err, domain.ErrLeaveRequestNotFound)
}

package repository_test

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

func newTestEmployee(t *testing.T, pool *pgxpool.Pool, seedPrefix string) *domain.User {
	t.Helper()
	users := repository.NewUserRepository(pool)
	ctx := context.Background()

	lineUserID := seedPrefix + "-" + time.Now().Format("20060102150405.000000000")
	employee, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Attendance Test", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM attendance_idempotency_keys WHERE attendance_record_id IN (SELECT id FROM attendance_records WHERE employee_id = $1)", employee.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM attendance_records WHERE employee_id = $1", employee.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", employee.ID)
	})
	return employee
}

func TestAttendanceRepository_CheckIn_CreatesRecord(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attendance-checkin")
	attendance := repository.NewAttendanceRepository(pool)
	ctx := context.Background()

	workDate := mustTime(t, "2006-01-02", "2026-05-04")
	checkInAt := workDate.Add(9 * time.Hour)

	rec, err := attendance.CheckIn(ctx, employee.ID, workDate, checkInAt, domain.AttendanceStatusPresent, "key-1")
	require.NoError(t, err)
	require.NotNil(t, rec.CheckInAt)
	require.Equal(t, domain.AttendanceStatusPresent, rec.Status)

	fetched, err := attendance.GetForEmployeeDate(ctx, employee.ID, workDate)
	require.NoError(t, err)
	require.Equal(t, rec.ID, fetched.ID)
}

func TestAttendanceRepository_CheckIn_IdempotentRetryReturnsSameRecord(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attendance-idempotent")
	attendance := repository.NewAttendanceRepository(pool)
	ctx := context.Background()

	workDate := mustTime(t, "2006-01-02", "2026-05-05")
	checkInAt := workDate.Add(9 * time.Hour)

	first, err := attendance.CheckIn(ctx, employee.ID, workDate, checkInAt, domain.AttendanceStatusPresent, "retry-key")
	require.NoError(t, err)

	// Same idempotency key, different (later) checkInAt — must return the
	// first attempt's record unchanged, not reprocess with the new time.
	second, err := attendance.CheckIn(ctx, employee.ID, workDate, checkInAt.Add(time.Hour), domain.AttendanceStatusLate, "retry-key")
	require.NoError(t, err)
	require.Equal(t, first.ID, second.ID)
	require.Equal(t, first.Status, second.Status, "a retried submit must not reprocess with different values")
	require.WithinDuration(t, *first.CheckInAt, *second.CheckInAt, 0)
}

func TestAttendanceRepository_CheckIn_RejectsDoubleCheckIn(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attendance-double")
	attendance := repository.NewAttendanceRepository(pool)
	ctx := context.Background()

	workDate := mustTime(t, "2006-01-02", "2026-05-06")
	checkInAt := workDate.Add(9 * time.Hour)

	_, err = attendance.CheckIn(ctx, employee.ID, workDate, checkInAt, domain.AttendanceStatusPresent, "key-a")
	require.NoError(t, err)

	// A genuinely new attempt (different idempotency key) for an
	// employee/date that already has a check-in must be rejected.
	_, err = attendance.CheckIn(ctx, employee.ID, workDate, checkInAt.Add(time.Minute), domain.AttendanceStatusPresent, "key-b")
	require.ErrorIs(t, err, domain.ErrAlreadyCheckedIn)
}

func TestAttendanceRepository_CheckIn_ConcurrentRequests_OnlyOneSucceeds(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attendance-concurrent")
	attendance := repository.NewAttendanceRepository(pool)
	ctx := context.Background()

	workDate := mustTime(t, "2006-01-02", "2026-05-07")
	checkInAt := workDate.Add(9 * time.Hour)

	const attempts = 10
	var wg sync.WaitGroup
	errs := make([]error, attempts)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			// Distinct idempotency keys on every goroutine — this is what
			// makes it a genuine race between separate check-in attempts,
			// not ten retries of the same one. The SELECT ... FOR UPDATE
			// lock inside CheckIn must serialize them so exactly one
			// inserts and the rest observe the row and get
			// ErrAlreadyCheckedIn, never a duplicate row or a lost update.
			_, errs[i] = attendance.CheckIn(ctx, employee.ID, workDate, checkInAt, domain.AttendanceStatusPresent, fmt.Sprintf("concurrent-key-%d", i))
		}(i)
	}
	wg.Wait()

	successCount, alreadyCheckedInCount := 0, 0
	for _, err := range errs {
		switch {
		case err == nil:
			successCount++
		case errors.Is(err, domain.ErrAlreadyCheckedIn):
			alreadyCheckedInCount++
		default:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	require.Equal(t, 1, successCount, "exactly one concurrent check-in must win")
	require.Equal(t, attempts-1, alreadyCheckedInCount)

	rec, err := attendance.GetForEmployeeDate(ctx, employee.ID, workDate)
	require.NoError(t, err)
	require.NotNil(t, rec)
}

func TestAttendanceRepository_CheckOut(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attendance-checkout")
	attendance := repository.NewAttendanceRepository(pool)
	ctx := context.Background()

	workDate := mustTime(t, "2006-01-02", "2026-05-08")
	checkInAt := workDate.Add(9 * time.Hour)
	checkOutAt := workDate.Add(17 * time.Hour)

	_, err = attendance.CheckIn(ctx, employee.ID, workDate, checkInAt, domain.AttendanceStatusPresent, "co-key-in")
	require.NoError(t, err)

	rec, err := attendance.CheckOut(ctx, employee.ID, workDate, checkOutAt, "co-key-out")
	require.NoError(t, err)
	require.NotNil(t, rec.CheckOutAt)

	_, err = attendance.CheckOut(ctx, employee.ID, workDate, checkOutAt.Add(time.Minute), "co-key-out-2")
	require.ErrorIs(t, err, domain.ErrAlreadyCheckedOut)
}

func TestAttendanceRepository_CheckOut_WithoutCheckIn(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attendance-noco")
	attendance := repository.NewAttendanceRepository(pool)
	ctx := context.Background()

	workDate := mustTime(t, "2006-01-02", "2026-05-09")
	_, err = attendance.CheckOut(ctx, employee.ID, workDate, workDate.Add(17*time.Hour), "no-checkin-key")
	require.ErrorIs(t, err, domain.ErrNotCheckedIn)
}

func TestAttendanceRepository_AutoCloseOpenRecords(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attendance-autoclose")
	attendance := repository.NewAttendanceRepository(pool)
	ctx := context.Background()

	// Yesterday relative to the cutoff used below — checked in, never
	// checked out.
	workDate := mustTime(t, "2006-01-02", "2026-05-10")
	checkInAt := workDate.Add(9 * time.Hour)
	_, err = attendance.CheckIn(ctx, employee.ID, workDate, checkInAt, domain.AttendanceStatusPresent, "autoclose-key")
	require.NoError(t, err)

	cutoff := mustTime(t, "2006-01-02", "2026-05-11")
	closed, err := attendance.AutoCloseOpenRecords(ctx, cutoff)
	require.NoError(t, err)
	require.GreaterOrEqual(t, closed, 1)

	rec, err := attendance.GetForEmployeeDate(ctx, employee.ID, workDate)
	require.NoError(t, err)
	require.NotNil(t, rec.CheckOutAt)
	require.True(t, rec.AutoClosed)

	// A second run must be a no-op (already closed, not re-touched into an
	// error or double-counted).
	closedAgain, err := attendance.AutoCloseOpenRecords(ctx, cutoff)
	require.NoError(t, err)
	require.Equal(t, 0, closedAgain)
}

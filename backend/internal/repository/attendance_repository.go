package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type AttendanceRepository struct {
	pool *pgxpool.Pool
}

func NewAttendanceRepository(pool *pgxpool.Pool) *AttendanceRepository {
	return &AttendanceRepository{pool: pool}
}

const attendanceColumns = `
	id::text, employee_id::text, work_date, check_in_at, check_out_at,
	status::text, auto_closed, created_at, updated_at`

func scanAttendance(row pgx.Row) (*domain.AttendanceRecord, error) {
	var a domain.AttendanceRecord
	var status string
	err := row.Scan(
		&a.ID, &a.EmployeeID, &a.WorkDate, &a.CheckInAt, &a.CheckOutAt,
		&status, &a.AutoClosed, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	a.Status = domain.AttendanceStatus(status)
	return &a, nil
}

func (r *AttendanceRepository) GetForEmployeeDate(ctx context.Context, employeeID string, workDate time.Time) (*domain.AttendanceRecord, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+attendanceColumns+`
		FROM attendance_records
		WHERE employee_id = $1 AND work_date = $2`,
		employeeID, workDate,
	)
	a, err := scanAttendance(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return a, err
}

// GetByIdempotencyKey is the same lookup as idempotentResult but against the
// plain pool, for callers checking before opening a transaction at all.
func (r *AttendanceRepository) GetByIdempotencyKey(ctx context.Context, idempotencyKey string) (*domain.AttendanceRecord, error) {
	var recordID string
	err := r.pool.QueryRow(ctx, `SELECT attendance_record_id::text FROM attendance_idempotency_keys WHERE key = $1`, idempotencyKey).Scan(&recordID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	row := r.pool.QueryRow(ctx, `SELECT `+attendanceColumns+` FROM attendance_records WHERE id = $1`, recordID)
	return scanAttendance(row)
}

// idempotentResult looks up a previously-completed request by key inside an
// open transaction. Returns (nil, nil) on a fresh key.
func idempotentResult(ctx context.Context, tx pgx.Tx, idempotencyKey string) (*domain.AttendanceRecord, error) {
	var recordID string
	err := tx.QueryRow(ctx, `SELECT attendance_record_id::text FROM attendance_idempotency_keys WHERE key = $1`, idempotencyKey).Scan(&recordID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	row := tx.QueryRow(ctx, `SELECT `+attendanceColumns+` FROM attendance_records WHERE id = $1`, recordID)
	return scanAttendance(row)
}

func recordIdempotencyKey(ctx context.Context, tx pgx.Tx, idempotencyKey, recordID string) error {
	_, err := tx.Exec(ctx, `INSERT INTO attendance_idempotency_keys (key, attendance_record_id) VALUES ($1, $2)`, idempotencyKey, recordID)
	return err
}

// CheckIn is the first transactional write path in this codebase: it locks
// any existing row for (employeeID, workDate) with SELECT ... FOR UPDATE
// before deciding whether to insert or reject, so two concurrent check-in
// attempts for the same employee/day can't both succeed.
func (r *AttendanceRepository) CheckIn(ctx context.Context, employeeID string, workDate, checkInAt time.Time, status domain.AttendanceStatus, idempotencyKey string) (*domain.AttendanceRecord, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if cached, err := idempotentResult(ctx, tx, idempotencyKey); err != nil {
		return nil, err
	} else if cached != nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return cached, nil
	}

	row := tx.QueryRow(ctx, `
		SELECT `+attendanceColumns+`
		FROM attendance_records
		WHERE employee_id = $1 AND work_date = $2
		FOR UPDATE`,
		employeeID, workDate,
	)
	existing, err := scanAttendance(row)

	var result *domain.AttendanceRecord
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		insertRow := tx.QueryRow(ctx, `
			INSERT INTO attendance_records (employee_id, work_date, check_in_at, status)
			VALUES ($1, $2, $3, $4)
			RETURNING `+attendanceColumns,
			employeeID, workDate, checkInAt, status,
		)
		result, err = scanAttendance(insertRow)
		if err != nil {
			return nil, err
		}
	case err != nil:
		return nil, err
	case existing.CheckInAt != nil:
		return nil, domain.ErrAlreadyCheckedIn
	default:
		updateRow := tx.QueryRow(ctx, `
			UPDATE attendance_records
			SET check_in_at = $3, status = $4, updated_at = now()
			WHERE employee_id = $1 AND work_date = $2
			RETURNING `+attendanceColumns,
			employeeID, workDate, checkInAt, status,
		)
		result, err = scanAttendance(updateRow)
		if err != nil {
			return nil, err
		}
	}

	if err := recordIdempotencyKey(ctx, tx, idempotencyKey, result.ID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *AttendanceRepository) CheckOut(ctx context.Context, employeeID string, workDate, checkOutAt time.Time, idempotencyKey string) (*domain.AttendanceRecord, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if cached, err := idempotentResult(ctx, tx, idempotencyKey); err != nil {
		return nil, err
	} else if cached != nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return cached, nil
	}

	row := tx.QueryRow(ctx, `
		SELECT `+attendanceColumns+`
		FROM attendance_records
		WHERE employee_id = $1 AND work_date = $2
		FOR UPDATE`,
		employeeID, workDate,
	)
	existing, err := scanAttendance(row)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && existing.CheckInAt == nil) {
		return nil, domain.ErrNotCheckedIn
	}
	if err != nil {
		return nil, err
	}
	if existing.CheckOutAt != nil {
		return nil, domain.ErrAlreadyCheckedOut
	}

	updateRow := tx.QueryRow(ctx, `
		UPDATE attendance_records
		SET check_out_at = $3, updated_at = now()
		WHERE employee_id = $1 AND work_date = $2
		RETURNING `+attendanceColumns,
		employeeID, workDate, checkOutAt,
	)
	result, err := scanAttendance(updateRow)
	if err != nil {
		return nil, err
	}

	if err := recordIdempotencyKey(ctx, tx, idempotencyKey, result.ID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

// AutoCloseOpenRecords sets check_out_at to the end of work_date
// (Asia/Bangkok) for every record checked in but never checked out before
// cutoff. A uniform end-of-day fallback, not the employee's scheduled end
// time — precise worked-hours capping to the schedule is a Reports (PR 7)
// concern layered on top of this raw check_out_at, not this job's.
func (r *AttendanceRepository) AutoCloseOpenRecords(ctx context.Context, cutoff time.Time) (int, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE attendance_records
		SET check_out_at = (work_date::timestamp + interval '23:59:59') AT TIME ZONE 'Asia/Bangkok',
		    auto_closed = true,
		    updated_at = now()
		WHERE check_in_at IS NOT NULL
		  AND check_out_at IS NULL
		  AND work_date < $1`,
		cutoff,
	)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// ListForMonth returns every attendance record (all employees) with
// work_date in [from, to) — the report queries' data source.
func (r *AttendanceRepository) ListForMonth(ctx context.Context, from, to time.Time) ([]*domain.AttendanceRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+attendanceColumns+`
		FROM attendance_records
		WHERE work_date >= $1 AND work_date < $2
		ORDER BY work_date, employee_id`,
		from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.AttendanceRecord
	for rows.Next() {
		a, err := scanAttendance(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

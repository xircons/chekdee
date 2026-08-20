package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type LeaveRequestRepository struct {
	pool *pgxpool.Pool
}

func NewLeaveRequestRepository(pool *pgxpool.Pool) *LeaveRequestRepository {
	return &LeaveRequestRepository{pool: pool}
}

const leaveRequestColumns = `
	id::text, employee_id::text, leave_type, start_date, end_date, reason, status::text,
	decided_by::text, decided_at, decided_from_ip, created_at, updated_at`

func scanLeaveRequest(row pgx.Row) (*domain.LeaveRequest, error) {
	var l domain.LeaveRequest
	var status string
	err := row.Scan(
		&l.ID, &l.EmployeeID, &l.LeaveType, &l.StartDate, &l.EndDate, &l.Reason, &status,
		&l.DecidedBy, &l.DecidedAt, &l.DecidedFromIP, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	l.Status = domain.LeaveStatus(status)
	return &l, nil
}

func (r *LeaveRequestRepository) Create(ctx context.Context, employeeID string, leaveType, reason *string, startDate, endDate time.Time) (*domain.LeaveRequest, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+leaveRequestColumns,
		employeeID, leaveType, startDate, endDate, reason,
	)
	return scanLeaveRequest(row)
}

func (r *LeaveRequestRepository) Get(ctx context.Context, id string) (*domain.LeaveRequest, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+leaveRequestColumns+` FROM leave_requests WHERE id = $1`, id)
	l, err := scanLeaveRequest(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrLeaveRequestNotFound
	}
	return l, err
}

func (r *LeaveRequestRepository) ListForEmployee(ctx context.Context, employeeID string) ([]*domain.LeaveRequest, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+leaveRequestColumns+`
		FROM leave_requests
		WHERE employee_id = $1
		ORDER BY created_at DESC`,
		employeeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanLeaveRequests(rows)
}

// ListAll sorts pending first (then most recent), matching the admin
// table's already-shipped ordering.
func (r *LeaveRequestRepository) ListAll(ctx context.Context) ([]*domain.LeaveRequest, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+leaveRequestColumns+`
		FROM leave_requests
		ORDER BY (status = 'pending') DESC, created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanLeaveRequests(rows)
}

func scanLeaveRequests(rows pgx.Rows) ([]*domain.LeaveRequest, error) {
	var out []*domain.LeaveRequest
	for rows.Next() {
		l, err := scanLeaveRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *LeaveRequestRepository) Decide(ctx context.Context, id string, status domain.LeaveStatus, decidedBy, decidedFromIP string) (*domain.LeaveRequest, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE leave_requests
		SET status = $2, decided_by = $3, decided_at = now(), decided_from_ip = $4, updated_at = now()
		WHERE id = $1 AND status = 'pending'
		RETURNING `+leaveRequestColumns,
		id, status, decidedBy, decidedFromIP,
	)
	l, err := scanLeaveRequest(row)
	if errors.Is(err, pgx.ErrNoRows) {
		// Either the row doesn't exist, or it does but isn't pending
		// anymore — distinguish so the handler can return the right code.
		if _, getErr := r.Get(ctx, id); errors.Is(getErr, domain.ErrLeaveRequestNotFound) {
			return nil, domain.ErrLeaveRequestNotFound
		}
		return nil, domain.ErrLeaveRequestAlreadyDecided
	}
	return l, err
}

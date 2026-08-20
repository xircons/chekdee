package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type ReportRepository struct {
	pool *pgxpool.Pool
}

func NewReportRepository(pool *pgxpool.Pool) *ReportRepository {
	return &ReportRepository{pool: pool}
}

// ApprovedLeaveDaysByEmployee mirrors the frontend's overlappingDaysInMonth
// clipping logic in SQL: for every approved request overlapping [from, to),
// count only the days that fall inside the range.
func (r *ReportRepository) ApprovedLeaveDaysByEmployee(ctx context.Context, from, to time.Time) (map[string]int, error) {
	// to is exclusive (matches AttendanceRepository.ListForMonth's
	// convention); leave_requests.end_date is inclusive, so the clip uses
	// (to - 1 day) as the inclusive upper bound.
	inclusiveTo := to.AddDate(0, 0, -1)

	rows, err := r.pool.Query(ctx, `
		SELECT employee_id::text,
		       SUM((LEAST(end_date, $2) - GREATEST(start_date, $1))::int + 1) AS leave_days
		FROM leave_requests
		WHERE status = 'approved'
		  AND start_date <= $2
		  AND end_date >= $1
		GROUP BY employee_id`,
		from, inclusiveTo,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var employeeID string
		var days int
		if err := rows.Scan(&employeeID, &days); err != nil {
			return nil, err
		}
		out[employeeID] = days
	}
	return out, rows.Err()
}

const reportExportColumns = `
	id::text, requested_by::text, month, status::text, file, error, created_at, completed_at`

func scanReportExport(row pgx.Row) (*domain.ReportExport, error) {
	var e domain.ReportExport
	var status string
	err := row.Scan(&e.ID, &e.RequestedBy, &e.Month, &status, &e.File, &e.Error, &e.CreatedAt, &e.CompletedAt)
	if err != nil {
		return nil, err
	}
	e.Status = domain.ReportExportStatus(status)
	return &e, nil
}

type ReportExportRepository struct {
	pool *pgxpool.Pool
}

func NewReportExportRepository(pool *pgxpool.Pool) *ReportExportRepository {
	return &ReportExportRepository{pool: pool}
}

func (r *ReportExportRepository) Create(ctx context.Context, requestedBy, month string) (*domain.ReportExport, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO report_exports (requested_by, month)
		VALUES ($1, $2)
		RETURNING `+reportExportColumns,
		requestedBy, month,
	)
	return scanReportExport(row)
}

func (r *ReportExportRepository) Get(ctx context.Context, id string) (*domain.ReportExport, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+reportExportColumns+` FROM report_exports WHERE id = $1`, id)
	e, err := scanReportExport(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrReportExportNotFound
	}
	return e, err
}

func (r *ReportExportRepository) MarkReady(ctx context.Context, id string, file []byte) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE report_exports SET status = 'ready', file = $2, completed_at = now() WHERE id = $1`,
		id, file,
	)
	return err
}

func (r *ReportExportRepository) MarkFailed(ctx context.Context, id string, errMsg string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE report_exports SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`,
		id, errMsg,
	)
	return err
}

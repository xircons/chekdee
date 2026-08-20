package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type HolidayRepository struct {
	pool *pgxpool.Pool
}

func NewHolidayRepository(pool *pgxpool.Pool) *HolidayRepository {
	return &HolidayRepository{pool: pool}
}

const holidayColumns = `
	id::text, date, name, local_name, source::text, updated_by::text, created_at, updated_at`

func scanHoliday(row pgx.Row) (*domain.Holiday, error) {
	var h domain.Holiday
	var source string
	err := row.Scan(
		&h.ID, &h.Date, &h.Name, &h.LocalName, &source, &h.UpdatedBy, &h.CreatedAt, &h.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	h.Source = domain.HolidaySource(source)
	return &h, nil
}

func (r *HolidayRepository) CreateManual(ctx context.Context, date time.Time, name, localName, updatedBy string) (*domain.Holiday, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO holidays (date, name, local_name, source, updated_by)
		VALUES ($1, $2, $3, 'manual', $4)
		RETURNING `+holidayColumns,
		date, name, localName, updatedBy,
	)
	return scanHoliday(row)
}

// Update never writes source — see the domain interface doc.
func (r *HolidayRepository) Update(ctx context.Context, id, name, localName, updatedBy string) (*domain.Holiday, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE holidays
		SET name = $2, local_name = $3, updated_by = $4, updated_at = now()
		WHERE id = $1
		RETURNING `+holidayColumns,
		id, name, localName, updatedBy,
	)
	h, err := scanHoliday(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrHolidayNotFound
	}
	return h, err
}

func (r *HolidayRepository) UpsertSynced(ctx context.Context, date time.Time, name, localName string) (*domain.Holiday, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO holidays (date, name, local_name, source)
		VALUES ($1, $2, $3, 'nager_date')
		ON CONFLICT (date) DO UPDATE
		SET name = EXCLUDED.name, local_name = EXCLUDED.local_name, updated_at = now()
		WHERE holidays.updated_by IS NULL
		RETURNING `+holidayColumns,
		date, name, localName,
	)
	h, err := scanHoliday(row)
	if errors.Is(err, pgx.ErrNoRows) {
		// The ON CONFLICT ... WHERE guard didn't match (the row exists and
		// was manually touched) — that's the "manual edits win" case, not an
		// error. Return the existing row unchanged.
		return r.getByDate(ctx, date)
	}
	return h, err
}

func (r *HolidayRepository) getByDate(ctx context.Context, date time.Time) (*domain.Holiday, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+holidayColumns+` FROM holidays WHERE date = $1`, date)
	h, err := scanHoliday(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrHolidayNotFound
	}
	return h, err
}

func (r *HolidayRepository) ListInRange(ctx context.Context, from, to time.Time) ([]*domain.Holiday, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+holidayColumns+`
		FROM holidays
		WHERE date BETWEEN $1 AND $2
		ORDER BY date`,
		from, to,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Holiday
	for rows.Next() {
		h, err := scanHoliday(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (r *HolidayRepository) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM holidays WHERE id = $1`, id)
	return err
}

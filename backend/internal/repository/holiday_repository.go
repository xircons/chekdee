package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository/sqlcgen"
)

type HolidayRepository struct {
	q *sqlcgen.Queries
}

func NewHolidayRepository(pool *pgxpool.Pool) *HolidayRepository {
	return &HolidayRepository{q: sqlcgen.New(pool)}
}

func toHoliday(h sqlcgen.Holiday) *domain.Holiday {
	return &domain.Holiday{
		ID:        uuidToString(h.ID),
		Date:      dateToTime(h.Date),
		Name:      h.Name,
		LocalName: textToStringPtr(h.LocalName),
		Source:    domain.HolidaySource(h.Source),
		UpdatedBy: uuidToStringPtr(h.UpdatedBy),
		CreatedAt: timestamptzToTime(h.CreatedAt),
		UpdatedAt: timestamptzToTime(h.UpdatedAt),
	}
}

// UpsertSynced is a no-op on the DB side (see db/queries/holidays.sql's
// WHERE clause) if the holiday was ever manually edited — that makes the
// INSERT...ON CONFLICT return zero rows, so we fall back to fetching the
// existing row instead of treating it as pgx.ErrNoRows.
func (r *HolidayRepository) UpsertSynced(ctx context.Context, date time.Time, name, localName string) (*domain.Holiday, error) {
	row, err := r.q.UpsertSyncedHoliday(ctx, sqlcgen.UpsertSyncedHolidayParams{
		Date:      timeToDate(date),
		Name:      name,
		LocalName: stringToText(localName),
	})
	if err == nil {
		return toHoliday(row), nil
	}

	existing, getErr := r.q.GetHolidayByDate(ctx, timeToDate(date))
	if getErr != nil {
		return nil, mapNoRows(getErr, domain.ErrHolidayNotFound)
	}
	return toHoliday(existing), nil
}

func (r *HolidayRepository) UpsertManual(ctx context.Context, date time.Time, name, localName, updatedBy string) (*domain.Holiday, error) {
	row, err := r.q.CreateOrUpdateManualHoliday(ctx, sqlcgen.CreateOrUpdateManualHolidayParams{
		Date:      timeToDate(date),
		Name:      name,
		LocalName: stringToText(localName),
		UpdatedBy: stringToUUID(updatedBy),
	})
	if err != nil {
		return nil, err
	}
	return toHoliday(row), nil
}

func (r *HolidayRepository) ListInRange(ctx context.Context, from, to time.Time) ([]*domain.Holiday, error) {
	rows, err := r.q.ListHolidaysInRange(ctx, sqlcgen.ListHolidaysInRangeParams{
		Date:   timeToDate(from),
		Date_2: timeToDate(to),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Holiday, 0, len(rows))
	for _, row := range rows {
		out = append(out, toHoliday(row))
	}
	return out, nil
}

func (r *HolidayRepository) Delete(ctx context.Context, id string) error {
	return r.q.DeleteHoliday(ctx, stringToUUID(id))
}

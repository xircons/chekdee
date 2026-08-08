package domain

import (
	"context"
	"errors"
	"time"
)

var ErrHolidayNotFound = errors.New("holiday not found")

type HolidaySource string

const (
	HolidaySourceNagerDate HolidaySource = "nager_date"
	HolidaySourceManual    HolidaySource = "manual"
)

type Holiday struct {
	ID        string
	Date      time.Time
	Name      string
	LocalName *string
	Source    HolidaySource
	UpdatedBy *string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type HolidayRepository interface {
	// UpsertSynced is a no-op (keeps the existing row) if the holiday was
	// ever manually edited — see db/queries/holidays.sql.
	UpsertSynced(ctx context.Context, date time.Time, name, localName string) (*Holiday, error)
	UpsertManual(ctx context.Context, date time.Time, name, localName, updatedBy string) (*Holiday, error)
	ListInRange(ctx context.Context, from, to time.Time) ([]*Holiday, error)
	Delete(ctx context.Context, id string) error
}

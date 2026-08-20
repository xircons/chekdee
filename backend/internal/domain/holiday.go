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
	// CreateManual inserts a brand-new holiday added by an admin — always
	// source='manual'. Use Update, not this, for editing an existing row
	// (including one that started life as 'nager_date').
	CreateManual(ctx context.Context, date time.Time, name, localName, updatedBy string) (*Holiday, error)
	// Update edits an existing holiday's name/local_name in place and never
	// touches source: editing a nager_date row must not flip it to manual,
	// per the migration comment and the admin panel's established rule.
	Update(ctx context.Context, id, name, localName, updatedBy string) (*Holiday, error)
	// UpsertSynced is the Nager.Date sync job's write path: inserts a new
	// nager_date row, or updates name/local_name of an existing one — but
	// only if it has never been touched by an admin (updated_by IS NULL).
	// A manual edit always wins over a later re-sync.
	UpsertSynced(ctx context.Context, date time.Time, name, localName string) (*Holiday, error)
	ListInRange(ctx context.Context, from, to time.Time) ([]*Holiday, error)
	// Delete is a real delete — holidays aren't subject to the soft-delete-
	// only rule that applies to users.
	Delete(ctx context.Context, id string) error
}

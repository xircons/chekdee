package jobs

import (
	"context"
	"fmt"
	"time"

	"github.com/riverqueue/river"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/nagerclient"
)

// NagerClient is implemented by *nagerclient.Client. A local interface (not
// the concrete type) so the worker can be tested against a fake.
type NagerClient interface {
	PublicHolidays(ctx context.Context, year int) ([]nagerclient.Holiday, error)
}

type HolidaySyncArgs struct {
	// Year to sync. The periodic schedule always passes the current year;
	// RunOnStart and manual re-triggers may pass others (e.g. to pre-seed
	// next year's holidays ahead of the new year).
	Year int
}

func (HolidaySyncArgs) Kind() string { return "holiday_sync" }

type HolidaySyncWorker struct {
	river.WorkerDefaults[HolidaySyncArgs]
	nager    NagerClient
	holidays domain.HolidayRepository
}

func NewHolidaySyncWorker(nager NagerClient, holidays domain.HolidayRepository) *HolidaySyncWorker {
	return &HolidaySyncWorker{nager: nager, holidays: holidays}
}

// Work upserts every holiday Nager.Date reports for the job's year.
// UpsertSynced is itself the "manual edits win" guard (see
// domain.HolidayRepository), so this loop doesn't need its own check.
func (w *HolidaySyncWorker) Work(ctx context.Context, job *river.Job[HolidaySyncArgs]) error {
	holidays, err := w.nager.PublicHolidays(ctx, job.Args.Year)
	if err != nil {
		return fmt.Errorf("holiday sync: fetch year %d: %w", job.Args.Year, err)
	}

	for _, h := range holidays {
		date, err := time.Parse("2006-01-02", h.Date)
		if err != nil {
			return fmt.Errorf("holiday sync: parse date %q: %w", h.Date, err)
		}
		if _, err := w.holidays.UpsertSynced(ctx, date, h.Name, h.LocalName); err != nil {
			return fmt.Errorf("holiday sync: upsert %s: %w", h.Date, err)
		}
	}
	return nil
}

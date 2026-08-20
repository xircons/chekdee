package jobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/jobs"
	"checkdee-backend/internal/nagerclient"
)

type fakeNagerClient struct {
	holidays []nagerclient.Holiday
	err      error
}

func (f *fakeNagerClient) PublicHolidays(_ context.Context, _ int) ([]nagerclient.Holiday, error) {
	return f.holidays, f.err
}

type fakeHolidayRepo struct {
	upserted []time.Time
	err      error
}

func (f *fakeHolidayRepo) CreateManual(context.Context, time.Time, string, string, string) (*domain.Holiday, error) {
	return nil, nil
}
func (f *fakeHolidayRepo) Update(context.Context, string, string, string, string) (*domain.Holiday, error) {
	return nil, nil
}
func (f *fakeHolidayRepo) UpsertSynced(_ context.Context, date time.Time, _, _ string) (*domain.Holiday, error) {
	if f.err != nil {
		return nil, f.err
	}
	f.upserted = append(f.upserted, date)
	return &domain.Holiday{Date: date}, nil
}
func (f *fakeHolidayRepo) ListInRange(context.Context, time.Time, time.Time) ([]*domain.Holiday, error) {
	return nil, nil
}
func (f *fakeHolidayRepo) Delete(context.Context, string) error { return nil }

func TestHolidaySyncWorker_Work_UpsertsEachHoliday(t *testing.T) {
	nager := &fakeNagerClient{holidays: []nagerclient.Holiday{
		{Date: "2026-01-01", Name: "New Year's Day", LocalName: "วันขึ้นปีใหม่"},
		{Date: "2026-04-13", Name: "Songkran", LocalName: "สงกรานต์"},
	}}
	repo := &fakeHolidayRepo{}
	worker := jobs.NewHolidaySyncWorker(nager, repo)

	err := worker.Work(context.Background(), &river.Job[jobs.HolidaySyncArgs]{Args: jobs.HolidaySyncArgs{Year: 2026}})
	require.NoError(t, err)
	require.Len(t, repo.upserted, 2)
}

func TestHolidaySyncWorker_Work_NagerErrorPropagates(t *testing.T) {
	nager := &fakeNagerClient{err: errors.New("nager unavailable")}
	repo := &fakeHolidayRepo{}
	worker := jobs.NewHolidaySyncWorker(nager, repo)

	err := worker.Work(context.Background(), &river.Job[jobs.HolidaySyncArgs]{Args: jobs.HolidaySyncArgs{Year: 2026}})
	require.Error(t, err)
	require.Empty(t, repo.upserted)
}

func TestHolidaySyncWorker_Work_InvalidDateErrors(t *testing.T) {
	nager := &fakeNagerClient{holidays: []nagerclient.Holiday{{Date: "not-a-date", Name: "Bad"}}}
	repo := &fakeHolidayRepo{}
	worker := jobs.NewHolidaySyncWorker(nager, repo)

	err := worker.Work(context.Background(), &river.Job[jobs.HolidaySyncArgs]{Args: jobs.HolidaySyncArgs{Year: 2026}})
	require.Error(t, err)
}

// Package jobs owns the river job-queue wiring.
package jobs

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

// Workers is the shared registry feature PRs register their workers on.
func Workers() *river.Workers {
	return river.NewWorkers()
}

// NewInsertOnlyClient builds a river client for enqueuing jobs without
// working any — no workers, never Start()ed. Kept for call sites that only
// need to insert (e.g. inside the same pgx transaction as a triggering
// write) without pulling in the full worker set.
func NewInsertOnlyClient(pool *pgxpool.Pool) (*river.Client[pgx.Tx], error) {
	return river.NewClient(riverpgxv5.New(pool), &river.Config{})
}

// NewClient builds the full, Start()able river client: the registered
// workers plus any periodic job schedules. There's no separate worker
// binary in this repo yet, so this runs embedded in cmd/server — Start() is
// called alongside the HTTP server and Stop() on graceful shutdown. A
// dedicated worker process is a reasonable later split if job volume ever
// warrants scaling it independently of the API.
func NewClient(pool *pgxpool.Pool, workers *river.Workers, periodicJobs []*river.PeriodicJob) (*river.Client[pgx.Tx], error) {
	return river.NewClient(riverpgxv5.New(pool), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault: {MaxWorkers: 5},
		},
		Workers:      workers,
		PeriodicJobs: periodicJobs,
	})
}

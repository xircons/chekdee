// Package jobs owns the river job-queue wiring. This is infrastructure only
// for now: an insert-only client that later usecases enqueue onto, and an
// empty worker registry. No jobs are registered yet — attendance auto-close,
// holiday sync, and leave-notification workers land with their feature PRs.
package jobs

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

// Workers is the shared registry feature PRs register their workers on.
// A dedicated worker process constructs a full client from it; the API
// server only inserts jobs, so it does not need the registry populated.
func Workers() *river.Workers {
	return river.NewWorkers()
}

// NewInsertOnlyClient builds a river client the API server uses purely to
// enqueue jobs inside the same pgx transaction as the triggering write.
// It registers no workers and is never Start()ed, so it does not consume a
// queue. The worker process (added later) will build a Start()able client
// with Queues + Workers configured.
func NewInsertOnlyClient(pool *pgxpool.Pool) (*river.Client[pgx.Tx], error) {
	return river.NewClient(riverpgxv5.New(pool), &river.Config{})
}

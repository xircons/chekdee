package usecase

import (
	"context"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
)

// RiverInsertClient is the subset of *river.Client this package's usecases
// need to enqueue a job — an interface so they don't have to depend on
// river's concrete generic Client[TTx] type wire.go constructs. Shared by
// ReportExportUsecase and LeaveUsecase.
type RiverInsertClient interface {
	Insert(ctx context.Context, args river.JobArgs, opts *river.InsertOpts) (*rivertype.JobInsertResult, error)
}

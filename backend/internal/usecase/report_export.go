package usecase

import (
	"context"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/jobs"
)

// ReportExportRiverClient is the subset of *river.Client this usecase needs
// — an interface so it doesn't have to depend on the concrete client type
// wire.go constructs.
type ReportExportRiverClient interface {
	Insert(ctx context.Context, args river.JobArgs, opts *river.InsertOpts) (*rivertype.JobInsertResult, error)
}

type ReportExportUsecase struct {
	exports domain.ReportExportRepository
	river   ReportExportRiverClient
}

func NewReportExportUsecase(exports domain.ReportExportRepository, riverClient ReportExportRiverClient) *ReportExportUsecase {
	return &ReportExportUsecase{exports: exports, river: riverClient}
}

// RequestExport creates the export row (status=processing) and enqueues the
// job that builds it — v1 has no export history, so this is a fire-and-poll
// flow, not a browsable list.
func (r *ReportExportUsecase) RequestExport(ctx context.Context, requestedBy, month string) (*domain.ReportExport, error) {
	export, err := r.exports.Create(ctx, requestedBy, month)
	if err != nil {
		return nil, err
	}

	if _, err := r.river.Insert(ctx, jobs.ReportExportArgs{ExportID: export.ID, Month: month}, nil); err != nil {
		_ = r.exports.MarkFailed(ctx, export.ID, "failed to enqueue export job: "+err.Error())
		return nil, err
	}
	return export, nil
}

func (r *ReportExportUsecase) GetExport(ctx context.Context, id string) (*domain.ReportExport, error) {
	return r.exports.Get(ctx, id)
}

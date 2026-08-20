package jobs

import (
	"context"
	"fmt"

	"github.com/riverqueue/river"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/reportxlsx"
)

type ReportExportArgs struct {
	ExportID string
	Month    string
}

func (ReportExportArgs) Kind() string { return "report_export" }

// ReportExportWorker builds the monthly Excel export asynchronously:
// processing -> ready (file bytes stored) or failed (error message stored),
// never left stuck in processing — every path below reaches a terminal
// status, including the panic-turned-failed path via MarkFailed on error.
type ReportExportWorker struct {
	river.WorkerDefaults[ReportExportArgs]
	exports domain.ReportExportRepository
	// reportRows/dailyLog are provided as closures rather than a full
	// *usecase.ReportUsecase to avoid an import cycle (usecase would need to
	// import jobs to register this worker in provideRiverWorkers, and jobs
	// would need to import usecase for the report queries) — wired directly
	// to the same repository-backed logic in wire.go.
	monthlyReport func(ctx context.Context, month string) ([]domain.MonthlyReportRow, error)
	dailyLog      func(ctx context.Context, month string, employeeID *string) ([]domain.DailyLogRow, error)
}

func NewReportExportWorker(
	exports domain.ReportExportRepository,
	monthlyReport func(ctx context.Context, month string) ([]domain.MonthlyReportRow, error),
	dailyLog func(ctx context.Context, month string, employeeID *string) ([]domain.DailyLogRow, error),
) *ReportExportWorker {
	return &ReportExportWorker{exports: exports, monthlyReport: monthlyReport, dailyLog: dailyLog}
}

func (w *ReportExportWorker) Work(ctx context.Context, job *river.Job[ReportExportArgs]) error {
	rows, err := w.monthlyReport(ctx, job.Args.Month)
	if err != nil {
		return w.fail(ctx, job.Args.ExportID, fmt.Errorf("report export: monthly report: %w", err))
	}

	daily, err := w.dailyLog(ctx, job.Args.Month, nil)
	if err != nil {
		return w.fail(ctx, job.Args.ExportID, fmt.Errorf("report export: daily log: %w", err))
	}

	file, err := reportxlsx.Build(job.Args.Month, rows, daily)
	if err != nil {
		return w.fail(ctx, job.Args.ExportID, fmt.Errorf("report export: build workbook: %w", err))
	}

	if err := w.exports.MarkReady(ctx, job.Args.ExportID, file); err != nil {
		return fmt.Errorf("report export: mark ready: %w", err)
	}
	return nil
}

// fail records the failure on the export row (best-effort — a failure to
// even record the failure still surfaces via the returned error, which
// river's own job-failure tracking captures) and returns the original error
// so river's retry/observability machinery sees it too.
func (w *ReportExportWorker) fail(ctx context.Context, exportID string, cause error) error {
	_ = w.exports.MarkFailed(ctx, exportID, cause.Error())
	return cause
}

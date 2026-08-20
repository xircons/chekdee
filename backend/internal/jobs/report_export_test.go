package jobs_test

import (
	"context"
	"errors"
	"testing"

	"github.com/riverqueue/river"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/jobs"
)

type fakeReportExportRepo struct {
	readyID   string
	readyFile []byte
	failedID  string
	failedErr string
}

func (f *fakeReportExportRepo) Create(context.Context, string, string) (*domain.ReportExport, error) {
	return nil, nil
}
func (f *fakeReportExportRepo) Get(context.Context, string) (*domain.ReportExport, error) {
	return nil, nil
}
func (f *fakeReportExportRepo) MarkReady(_ context.Context, id string, file []byte) error {
	f.readyID = id
	f.readyFile = file
	return nil
}
func (f *fakeReportExportRepo) MarkFailed(_ context.Context, id string, errMsg string) error {
	f.failedID = id
	f.failedErr = errMsg
	return nil
}

func TestReportExportWorker_Work_Success(t *testing.T) {
	exports := &fakeReportExportRepo{}
	monthlyReport := func(context.Context, string) ([]domain.MonthlyReportRow, error) {
		return []domain.MonthlyReportRow{{EmployeeID: "e1", WorkDays: 20}}, nil
	}
	dailyLog := func(context.Context, string, *string) ([]domain.DailyLogRow, error) {
		return nil, nil
	}
	worker := jobs.NewReportExportWorker(exports, monthlyReport, dailyLog)

	err := worker.Work(context.Background(), &river.Job[jobs.ReportExportArgs]{
		Args: jobs.ReportExportArgs{ExportID: "export-1", Month: "2026-03"},
	})
	require.NoError(t, err)
	require.Equal(t, "export-1", exports.readyID)
	require.NotEmpty(t, exports.readyFile, "a real .xlsx must have been built and stored")
	require.Empty(t, exports.failedID)
}

func TestReportExportWorker_Work_MonthlyReportErrorMarksFailed(t *testing.T) {
	exports := &fakeReportExportRepo{}
	monthlyReport := func(context.Context, string) ([]domain.MonthlyReportRow, error) {
		return nil, errors.New("db down")
	}
	dailyLog := func(context.Context, string, *string) ([]domain.DailyLogRow, error) { return nil, nil }
	worker := jobs.NewReportExportWorker(exports, monthlyReport, dailyLog)

	err := worker.Work(context.Background(), &river.Job[jobs.ReportExportArgs]{
		Args: jobs.ReportExportArgs{ExportID: "export-2", Month: "2026-03"},
	})
	require.Error(t, err)
	require.Equal(t, "export-2", exports.failedID)
	require.Empty(t, exports.readyID, "must not mark ready after a failure")
}

func TestReportExportWorker_Work_DailyLogErrorMarksFailed(t *testing.T) {
	exports := &fakeReportExportRepo{}
	monthlyReport := func(context.Context, string) ([]domain.MonthlyReportRow, error) { return nil, nil }
	dailyLog := func(context.Context, string, *string) ([]domain.DailyLogRow, error) {
		return nil, errors.New("db down")
	}
	worker := jobs.NewReportExportWorker(exports, monthlyReport, dailyLog)

	err := worker.Work(context.Background(), &river.Job[jobs.ReportExportArgs]{
		Args: jobs.ReportExportArgs{ExportID: "export-3", Month: "2026-03"},
	})
	require.Error(t, err)
	require.Equal(t, "export-3", exports.failedID)
}

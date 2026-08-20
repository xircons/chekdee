package repository_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

func TestReportExportRepository_CreateGetMarkReady(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	admin := newTestEmployee(t, pool, "test-report-export-admin")
	exports := repository.NewReportExportRepository(pool)
	ctx := context.Background()

	created, err := exports.Create(ctx, admin.ID, "2026-03")
	require.NoError(t, err)
	require.Equal(t, domain.ReportExportStatusProcessing, created.Status)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM report_exports WHERE id = $1", created.ID)
	})

	fetched, err := exports.Get(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, created.ID, fetched.ID)
	require.Equal(t, domain.ReportExportStatusProcessing, fetched.Status)
	require.Nil(t, fetched.CompletedAt)

	fileBytes := []byte("fake-xlsx-content")
	require.NoError(t, exports.MarkReady(ctx, created.ID, fileBytes))

	ready, err := exports.Get(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, domain.ReportExportStatusReady, ready.Status)
	require.Equal(t, fileBytes, ready.File)
	require.NotNil(t, ready.CompletedAt)
}

func TestReportExportRepository_MarkFailed(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	admin := newTestEmployee(t, pool, "test-report-export-fail-admin")
	exports := repository.NewReportExportRepository(pool)
	ctx := context.Background()

	created, err := exports.Create(ctx, admin.ID, "2026-04")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM report_exports WHERE id = $1", created.ID)
	})

	require.NoError(t, exports.MarkFailed(ctx, created.ID, "boom"))

	failed, err := exports.Get(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, domain.ReportExportStatusFailed, failed.Status)
	require.NotNil(t, failed.Error)
	require.Equal(t, "boom", *failed.Error)
}

func TestReportExportRepository_Get_NotFound(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	exports := repository.NewReportExportRepository(pool)
	_, err = exports.Get(context.Background(), "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, domain.ErrReportExportNotFound)
}

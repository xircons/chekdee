package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

func TestHolidayRepository_UpsertSynced_ThenUpdate_PreservesSource(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	holidays := repository.NewHolidayRepository(pool)
	ctx := context.Background()

	lineUserID := "test-holiday-admin-" + time.Now().Format("20060102150405.000000000")
	admin, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Holiday Admin", "")
	require.NoError(t, err)

	date := mustTime(t, "2006-01-02", "2026-04-13")
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM holidays WHERE date = $1", date)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", admin.ID)
	})

	// Sync creates a nager_date row.
	synced, err := holidays.UpsertSynced(ctx, date, "Songkran", "สงกรานต์")
	require.NoError(t, err)
	require.Equal(t, domain.HolidaySourceNagerDate, synced.Source)

	// Admin edits its name — source must stay nager_date, not flip to manual.
	updated, err := holidays.Update(ctx, synced.ID, "Songkran Festival", "สงกรานต์", admin.ID)
	require.NoError(t, err)
	require.Equal(t, domain.HolidaySourceNagerDate, updated.Source)
	require.Equal(t, "Songkran Festival", updated.Name)

	// A later re-sync with the original name must NOT clobber the admin's
	// edit — updated_by is now set, so UpsertSynced's guard must no-op.
	resynced, err := holidays.UpsertSynced(ctx, date, "Songkran", "สงกรานต์")
	require.NoError(t, err)
	require.Equal(t, "Songkran Festival", resynced.Name, "manual edit must survive a re-sync")
}

func TestHolidayRepository_CreateManual_Update_Delete(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	holidays := repository.NewHolidayRepository(pool)
	ctx := context.Background()

	lineUserID := "test-holiday-manual-admin-" + time.Now().Format("20060102150405.000000000")
	admin, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Manual Holiday Admin", "")
	require.NoError(t, err)

	date := mustTime(t, "2006-01-02", "2026-09-09")
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM holidays WHERE date = $1", date)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", admin.ID)
	})

	created, err := holidays.CreateManual(ctx, date, "CAMT Founding Day", "", admin.ID)
	require.NoError(t, err)
	require.Equal(t, domain.HolidaySourceManual, created.Source)

	list, err := holidays.ListInRange(ctx, mustTime(t, "2006-01-02", "2026-09-01"), mustTime(t, "2006-01-02", "2026-09-30"))
	require.NoError(t, err)
	require.Len(t, list, 1)

	require.NoError(t, holidays.Delete(ctx, created.ID))

	list, err = holidays.ListInRange(ctx, mustTime(t, "2006-01-02", "2026-09-01"), mustTime(t, "2006-01-02", "2026-09-30"))
	require.NoError(t, err)
	require.Empty(t, list)
}

func TestHolidayRepository_Update_NotFound(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	holidays := repository.NewHolidayRepository(pool)

	_, err = holidays.Update(context.Background(), "00000000-0000-0000-0000-000000000000", "x", "y", "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, domain.ErrHolidayNotFound)
}

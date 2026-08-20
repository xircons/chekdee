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

func TestKioskDeviceRepository_CreateRotateRevoke(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	devices := repository.NewKioskDeviceRepository(pool)
	ctx := context.Background()

	lineUserID := "test-kiosk-admin-" + time.Now().Format("20060102150405.000000000")
	admin, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Kiosk Admin", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM kiosk_devices WHERE created_by = $1", admin.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", admin.ID)
	})

	created, err := devices.Create(ctx, "Lobby TV", "hash-1", admin.ID)
	require.NoError(t, err)
	require.True(t, created.IsActive())

	byHash, err := devices.GetActiveByTokenHash(ctx, "hash-1")
	require.NoError(t, err)
	require.Equal(t, created.ID, byHash.ID)

	byDeviceID, err := devices.GetActiveByDeviceID(ctx, created.DeviceID)
	require.NoError(t, err)
	require.Equal(t, created.ID, byDeviceID.ID)

	// Rotate: old row revoked, new row active, same device_id, name carried over.
	rotated, err := devices.Rotate(ctx, created.DeviceID, "hash-2")
	require.NoError(t, err)
	require.Equal(t, created.DeviceID, rotated.DeviceID)
	require.Equal(t, "Lobby TV", rotated.Name)
	require.NotEqual(t, created.ID, rotated.ID)

	_, err = devices.GetActiveByTokenHash(ctx, "hash-1")
	require.ErrorIs(t, err, domain.ErrKioskDeviceNotFound, "old token must no longer be active")

	byHash2, err := devices.GetActiveByTokenHash(ctx, "hash-2")
	require.NoError(t, err)
	require.Equal(t, rotated.ID, byHash2.ID)

	// Assert this test's device is present, not that it's the only one —
	// ListActive is global, so other devices (other tests, manual dev-DB
	// usage) may legitimately coexist.
	active, err := devices.ListActive(ctx)
	require.NoError(t, err)
	require.Contains(t, deviceIDs(active), rotated.ID)

	require.NoError(t, devices.Revoke(ctx, created.DeviceID))
	_, err = devices.GetActiveByDeviceID(ctx, created.DeviceID)
	require.ErrorIs(t, err, domain.ErrKioskDeviceNotFound)

	require.ErrorIs(t, devices.Revoke(ctx, created.DeviceID), domain.ErrKioskDeviceNotFound, "revoking an already-revoked device is an error, not a no-op")
}

func deviceIDs(devices []*domain.KioskDevice) []string {
	ids := make([]string, 0, len(devices))
	for _, d := range devices {
		ids = append(ids, d.ID)
	}
	return ids
}

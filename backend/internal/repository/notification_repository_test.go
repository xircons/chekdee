package repository_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

func TestNotificationRepository_CreateListMarkRead(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-notification-employee")
	notifications := repository.NewNotificationRepository(pool)
	ctx := context.Background()
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM notifications WHERE recipient_id = $1", employee.ID)
	})

	body := "รายละเอียด"
	require.NoError(t, notifications.Create(ctx, employee.ID, "leave.decided", "หัวข้อ", &body, map[string]string{"k": "v"}))

	all, err := notifications.ListForRecipient(ctx, employee.ID, false)
	require.NoError(t, err)
	require.Len(t, all, 1)
	require.Equal(t, "leave.decided", all[0].Type)
	require.Nil(t, all[0].ReadAt)

	unreadOnly, err := notifications.ListForRecipient(ctx, employee.ID, true)
	require.NoError(t, err)
	require.Len(t, unreadOnly, 1)

	require.NoError(t, notifications.MarkRead(ctx, all[0].ID, employee.ID))

	afterRead, err := notifications.ListForRecipient(ctx, employee.ID, false)
	require.NoError(t, err)
	require.NotNil(t, afterRead[0].ReadAt)

	unreadAfter, err := notifications.ListForRecipient(ctx, employee.ID, true)
	require.NoError(t, err)
	require.Empty(t, unreadAfter, "a read notification must not appear in the unread-only list")
}

func TestNotificationRepository_MarkRead_ScopedToRecipient(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	owner := newTestEmployee(t, pool, "test-notification-owner")
	other := newTestEmployee(t, pool, "test-notification-other")
	notifications := repository.NewNotificationRepository(pool)
	ctx := context.Background()
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM notifications WHERE recipient_id IN ($1, $2)", owner.ID, other.ID)
	})

	require.NoError(t, notifications.Create(ctx, owner.ID, "leave.decided", "หัวข้อ", nil, nil))
	list, err := notifications.ListForRecipient(ctx, owner.ID, false)
	require.NoError(t, err)
	require.Len(t, list, 1)

	err = notifications.MarkRead(ctx, list[0].ID, other.ID)
	require.ErrorIs(t, err, domain.ErrNotificationNotFound, "another user must not be able to mark someone else's notification read")
}

func TestNotificationRepository_MarkRead_NotFound(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	notifications := repository.NewNotificationRepository(pool)
	err = notifications.MarkRead(context.Background(), "00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, domain.ErrNotificationNotFound)
}

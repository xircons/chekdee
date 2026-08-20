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

func TestRefreshTokenRepository_CreateGetRevoke(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	tokens := repository.NewRefreshTokenRepository(pool)
	ctx := context.Background()

	lineUserID := "test-rt-user-" + time.Now().Format("20060102150405.000000000")
	user, err := users.CreateEmployeeFromLine(ctx, lineUserID, "RT Test", "")
	require.NoError(t, err)
	// Registered after pool.Close so it runs first (LIFO), and deletes
	// refresh_tokens before users — the FK has no ON DELETE CASCADE.
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM refresh_tokens WHERE user_id = $1", user.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", user.ID)
	})

	hash := "test-hash-" + time.Now().Format("20060102150405.000000000")
	require.NoError(t, tokens.Create(ctx, user.ID, hash, "test-agent", "127.0.0.1", time.Now().Add(time.Hour)))

	active, err := tokens.GetActive(ctx, hash)
	require.NoError(t, err)
	require.Equal(t, user.ID, active.UserID)
	require.Nil(t, active.RevokedAt)

	require.NoError(t, tokens.Revoke(ctx, hash))

	_, err = tokens.GetActive(ctx, hash)
	require.ErrorIs(t, err, domain.ErrRefreshTokenInvalid)
}

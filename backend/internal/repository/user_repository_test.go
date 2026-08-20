package repository_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

// Requires a real Postgres reachable via DATABASE_URL with migrations
// applied (`docker compose up -d postgres && make migrate-up`). Skipped
// otherwise — this isn't wired to testcontainers-go yet, see design.md.
func TestUserRepository_CreateFetchRegister(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	lineUserID := "test-line-user-" + time.Now().Format("20060102150405.000000000")
	// Registered after the pool.Close cleanup, so it runs first (t.Cleanup
	// is LIFO) — a prior version had `defer pool.Close()` instead, which
	// ran before this delete could execute, silently leaking test rows.
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE line_user_id = $1", lineUserID)
	})

	created, err := repo.CreateEmployeeFromLine(ctx, lineUserID, "Test User", "https://example.com/pic.jpg")
	require.NoError(t, err)
	require.Equal(t, "employee", string(created.Role))
	require.False(t, created.IsRegistered())
	require.NotNil(t, created.LineDisplayName)
	require.Equal(t, "Test User", *created.LineDisplayName)

	fetched, err := repo.GetByLineUserID(ctx, lineUserID)
	require.NoError(t, err)
	require.Equal(t, created.ID, fetched.ID)

	require.NoError(t, repo.UpdateLineProfile(ctx, created.ID, "Updated Name", "https://example.com/new.jpg"))

	updated, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, "Updated Name", *updated.LineDisplayName)

	registered, err := repo.CompleteRegistration(ctx, created.ID, "First", "Last", "68")
	require.NoError(t, err)
	require.True(t, registered.IsRegistered())
	require.Equal(t, "First", *registered.FirstName)
	require.Equal(t, "Last", *registered.LastName)
	require.Equal(t, "68", *registered.StudentGen)
}

func TestUserRepository_GetByLineUserID_NotFound(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	repo := repository.NewUserRepository(pool)
	_, err = repo.GetByLineUserID(context.Background(), "does-not-exist")
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

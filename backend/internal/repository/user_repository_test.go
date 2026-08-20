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

// Requires a real Postgres reachable via DATABASE_URL with migrations
// applied (`docker compose up -d postgres && make migrate-up`). Skipped
// locally when DATABASE_URL is unset; a hard failure in CI (see requireDB).
func TestUserRepository_CreateFetchRegister(t *testing.T) {
	databaseURL := requireDB(t)

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
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	repo := repository.NewUserRepository(pool)
	_, err = repo.GetByLineUserID(context.Background(), "does-not-exist")
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

func TestUserRepository_List_FiltersAndPaginates(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	// A unique marker embedded in first_name so this test's rows can be
	// isolated from anything else in a shared table via the search filter,
	// same "assert presence, not exclusivity" approach as the kiosk device
	// repository test.
	marker := "ListTest" + time.Now().Format("20060102150405.000000000")

	var teamID string
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO teams (name) VALUES ($1) RETURNING id::text", marker+"-team",
	).Scan(&teamID))
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM teams WHERE id = $1", teamID)
	})

	alice, err := repo.CreateEmployeeFromLine(ctx, marker+"-line-alice", marker+" Alice", "")
	require.NoError(t, err)
	bob, err := repo.CreateEmployeeFromLine(ctx, marker+"-line-bob", marker+" Bob", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = ANY($1)", []string{alice.ID, bob.ID})
	})

	firstName, lastName := marker+" Alice", "Employee"
	_, err = repo.Update(ctx, alice.ID, &firstName, &lastName, &teamID)
	require.NoError(t, err)

	// search: both rows share the marker in first_name.
	role := domain.RoleEmployee
	_, total, err := repo.List(ctx, domain.EmployeeListFilter{Search: marker, Role: &role, Limit: 50})
	require.NoError(t, err)
	require.Equal(t, 2, total)

	// team_id: only alice was assigned to the fresh team.
	rows, total, err := repo.List(ctx, domain.EmployeeListFilter{TeamID: &teamID, Limit: 50})
	require.NoError(t, err)
	require.Equal(t, 1, total)
	require.Equal(t, alice.ID, rows[0].ID)

	// status: default (no filter) sees both; offboarding bob must remove him
	// from the "active" filter and surface him under "offboarded".
	_, err = repo.Offboard(ctx, bob.ID, alice.ID, nil)
	require.NoError(t, err)

	activeStatus := "active"
	_, total, err = repo.List(ctx, domain.EmployeeListFilter{Search: marker, OffboardStatus: &activeStatus, Limit: 50})
	require.NoError(t, err)
	require.Equal(t, 1, total, "only alice should still be active")

	offboardedStatus := "offboarded"
	rows, total, err = repo.List(ctx, domain.EmployeeListFilter{Search: marker, OffboardStatus: &offboardedStatus, Limit: 50})
	require.NoError(t, err)
	require.Equal(t, 1, total)
	require.Equal(t, bob.ID, rows[0].ID)

	// pagination: 2 matching rows total, one page of 1 each, no overlap.
	page1, total, err := repo.List(ctx, domain.EmployeeListFilter{Search: marker, Limit: 1, Offset: 0})
	require.NoError(t, err)
	require.Equal(t, 2, total)
	require.Len(t, page1, 1)

	page2, total, err := repo.List(ctx, domain.EmployeeListFilter{Search: marker, Limit: 1, Offset: 1})
	require.NoError(t, err)
	require.Equal(t, 2, total)
	require.Len(t, page2, 1)
	require.NotEqual(t, page1[0].ID, page2[0].ID, "the two pages must not overlap")
}

func TestUserRepository_Update(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	lineUserID := "test-update-" + time.Now().Format("20060102150405.000000000")
	created, err := repo.CreateEmployeeFromLine(ctx, lineUserID, "Original Name", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", created.ID)
	})

	first, last := "New", "Name"
	updated, err := repo.Update(ctx, created.ID, &first, &last, nil)
	require.NoError(t, err)
	require.Equal(t, "New", *updated.FirstName)
	require.Equal(t, "Name", *updated.LastName)
	require.Nil(t, updated.TeamID)
	// Role/offboarding must be untouched by Update — see the interface
	// doc comment for why those are separate methods.
	require.Equal(t, domain.RoleEmployee, updated.Role)
	require.Nil(t, updated.OffboardedAt)
}

func TestUserRepository_Update_NotFound(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	repo := repository.NewUserRepository(pool)
	first, last := "X", "Y"
	_, err = repo.Update(context.Background(), "00000000-0000-0000-0000-000000000000", &first, &last, nil)
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

func TestUserRepository_UpdateRole(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	lineUserID := "test-update-role-" + time.Now().Format("20060102150405.000000000")
	created, err := repo.CreateEmployeeFromLine(ctx, lineUserID, "Role Test", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", created.ID)
	})

	updated, err := repo.UpdateRole(ctx, created.ID, domain.RoleSupervisor)
	require.NoError(t, err)
	require.Equal(t, domain.RoleSupervisor, updated.Role)
}

func TestUserRepository_Offboard_RejectsAlreadyOffboarded(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	lineUserID := "test-offboard-" + time.Now().Format("20060102150405.000000000")
	created, err := repo.CreateEmployeeFromLine(ctx, lineUserID, "Offboard Test", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", created.ID)
	})

	reason := "resigned"
	offboarded, err := repo.Offboard(ctx, created.ID, created.ID, &reason)
	require.NoError(t, err)
	require.NotNil(t, offboarded.OffboardedAt)
	require.Equal(t, created.ID, *offboarded.OffboardedBy)
	require.Equal(t, "resigned", *offboarded.OffboardedReason)

	_, err = repo.Offboard(ctx, created.ID, created.ID, &reason)
	require.ErrorIs(t, err, domain.ErrUserAlreadyOffboarded)
}

func TestUserRepository_Offboard_NotFound(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	repo := repository.NewUserRepository(pool)
	reason := "n/a"
	_, err = repo.Offboard(context.Background(), "00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000", &reason)
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

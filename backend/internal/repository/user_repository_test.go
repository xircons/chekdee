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

	registered, err := repo.CompleteRegistration(ctx, created.ID, "First", "Last", "68", nil, nil)
	require.NoError(t, err)
	require.True(t, registered.IsRegistered())
	require.Equal(t, "First", *registered.FirstName)
	require.Equal(t, "Last", *registered.LastName)
	require.Equal(t, "68", *registered.StudentGen)
	require.Nil(t, registered.StudentID, "optional, not supplied")
	require.Nil(t, registered.PhoneNumber, "optional, not supplied")
}

// TestUserRepository_CompleteRegistration_WithStudentIDAndPhoneNumber
// round-trips the two optional fields end to end: supplied at registration,
// persisted, and readable back via a fresh GetByID (not just echoed in the
// RETURNING clause).
func TestUserRepository_CompleteRegistration_WithStudentIDAndPhoneNumber(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	lineUserID := "test-register-profile-fields-" + time.Now().Format("20060102150405.000000000")
	created, err := repo.CreateEmployeeFromLine(ctx, lineUserID, "Test User", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", created.ID)
	})

	studentID, phoneNumber := "652110145", "082-345-6789"
	registered, err := repo.CompleteRegistration(ctx, created.ID, "First", "Last", "68", &studentID, &phoneNumber)
	require.NoError(t, err)
	require.Equal(t, "652110145", *registered.StudentID)
	require.Equal(t, "082-345-6789", *registered.PhoneNumber)

	fetched, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, "652110145", *fetched.StudentID)
	require.Equal(t, "082-345-6789", *fetched.PhoneNumber)
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
	_, err = repo.Update(ctx, alice.ID, &firstName, &lastName, &teamID, nil, nil, nil)
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
	targetType := "user"
	_, err = repo.Offboard(ctx, bob.ID, nil, &domain.AdminAuditLog{
		ActorID: alice.ID, Action: "employee.offboard", TargetType: &targetType, TargetID: &bob.ID,
	})
	require.NoError(t, err)
	// admin_audit_logs.actor_id FK-references users(id) RESTRICT — must be
	// gone before the users cleanup above runs. t.Cleanup is LIFO, so
	// registering this after guarantees it runs first.
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM admin_audit_logs WHERE actor_id = $1", alice.ID)
	})

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
	studentGen, studentID, phoneNumber := "7", "672110160", "081-234-5678"
	updated, err := repo.Update(ctx, created.ID, &first, &last, nil, &studentGen, &studentID, &phoneNumber)
	require.NoError(t, err)
	require.Equal(t, "New", *updated.FirstName)
	require.Equal(t, "Name", *updated.LastName)
	require.Nil(t, updated.TeamID)
	require.Equal(t, "7", *updated.StudentGen)
	require.Equal(t, "672110160", *updated.StudentID)
	require.Equal(t, "081-234-5678", *updated.PhoneNumber)
	// Role/offboarding must be untouched by Update — see the interface
	// doc comment for why those are separate methods.
	require.Equal(t, domain.RoleEmployee, updated.Role)
	require.Nil(t, updated.OffboardedAt)

	// Round-trip: a fresh GetByID sees the same values, confirming they
	// actually persisted rather than just being echoed back in the
	// RETURNING clause.
	fetched, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, "7", *fetched.StudentGen)
	require.Equal(t, "672110160", *fetched.StudentID)
	require.Equal(t, "081-234-5678", *fetched.PhoneNumber)

	// nil clears them — Update is a full replace of these fields, not a
	// partial patch (same contract as team_id above).
	cleared, err := repo.Update(ctx, created.ID, &first, &last, nil, nil, nil, nil)
	require.NoError(t, err)
	require.Nil(t, cleared.StudentGen)
	require.Nil(t, cleared.StudentID)
	require.Nil(t, cleared.PhoneNumber)
}

func TestUserRepository_Update_NotFound(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	repo := repository.NewUserRepository(pool)
	first, last := "X", "Y"
	_, err = repo.Update(context.Background(), "00000000-0000-0000-0000-000000000000", &first, &last, nil, nil, nil, nil)
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

	targetType := "user"
	updated, err := repo.UpdateRole(ctx, created.ID, domain.RoleSupervisor, &domain.AdminAuditLog{
		ActorID: created.ID, Action: "employee.update_role", TargetType: &targetType, TargetID: &created.ID,
	})
	require.NoError(t, err)
	require.Equal(t, domain.RoleSupervisor, updated.Role)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM admin_audit_logs WHERE actor_id = $1", created.ID)
	})

	// The mutation and its audit entry must commit in the same transaction.
	var auditAction string
	require.NoError(t, pool.QueryRow(ctx,
		"SELECT action FROM admin_audit_logs WHERE target_id = $1", created.ID,
	).Scan(&auditAction))
	require.Equal(t, "employee.update_role", auditAction)
}

// TestUserRepository_UpdateRole_RejectsSystemOwnerTarget exercises the
// WHERE role <> 'system_owner' backstop directly at the repository level
// (bypassing EmployeeUsecase's own system_owner check entirely), and
// confirms it's disambiguated from not-found rather than surfacing as a
// generic "0 rows" error.
func TestUserRepository_UpdateRole_RejectsSystemOwnerTarget(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	username := "test-owner-role-" + time.Now().Format("20060102150405.000000000")
	owner, err := repo.CreateSystemOwner(ctx, username, "irrelevant-hash")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", owner.ID)
	})

	targetType := "user"
	_, err = repo.UpdateRole(ctx, owner.ID, domain.RoleAdmin, &domain.AdminAuditLog{
		ActorID: owner.ID, Action: "employee.update_role", TargetType: &targetType, TargetID: &owner.ID,
	})
	require.ErrorIs(t, err, domain.ErrCannotModifySystemOwnerRole)

	// No audit row should exist — the backstop must reject before the
	// transaction ever reaches the audit insert.
	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM admin_audit_logs WHERE target_id = $1", owner.ID).Scan(&count))
	require.Equal(t, 0, count)
}

// TestUserRepository_Offboard_RejectsSystemOwnerTarget is the Offboard
// analogue of the UpdateRole test above.
func TestUserRepository_Offboard_RejectsSystemOwnerTarget(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	repo := repository.NewUserRepository(pool)
	ctx := context.Background()

	username := "test-owner-offboard-" + time.Now().Format("20060102150405.000000000")
	owner, err := repo.CreateSystemOwner(ctx, username, "irrelevant-hash")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", owner.ID)
	})

	reason := "should not apply"
	targetType := "user"
	_, err = repo.Offboard(ctx, owner.ID, &reason, &domain.AdminAuditLog{
		ActorID: owner.ID, Action: "employee.offboard", TargetType: &targetType, TargetID: &owner.ID, Reason: &reason,
	})
	require.ErrorIs(t, err, domain.ErrCannotOffboardSystemOwner)

	var count int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM admin_audit_logs WHERE target_id = $1", owner.ID).Scan(&count))
	require.Equal(t, 0, count)
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
	targetType := "user"
	auditEntry := &domain.AdminAuditLog{
		ActorID: created.ID, Action: "employee.offboard", TargetType: &targetType, TargetID: &created.ID, Reason: &reason,
	}
	offboarded, err := repo.Offboard(ctx, created.ID, &reason, auditEntry)
	require.NoError(t, err)
	require.NotNil(t, offboarded.OffboardedAt)
	require.Equal(t, created.ID, *offboarded.OffboardedBy)
	require.Equal(t, "resigned", *offboarded.OffboardedReason)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM admin_audit_logs WHERE actor_id = $1", created.ID)
	})

	_, err = repo.Offboard(ctx, created.ID, &reason, auditEntry)
	require.ErrorIs(t, err, domain.ErrUserAlreadyOffboarded)
}

func TestUserRepository_Offboard_NotFound(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	repo := repository.NewUserRepository(pool)
	reason := "n/a"
	dummyID := "00000000-0000-0000-0000-000000000000"
	_, err = repo.Offboard(context.Background(), dummyID, &reason, &domain.AdminAuditLog{
		ActorID: dummyID, Action: "employee.offboard",
	})
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

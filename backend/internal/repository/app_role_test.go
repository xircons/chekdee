package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

// TestAppRole_AuditLogInsertOnly connects directly as checkdee_app (not
// through the owner-role pool the other tests use) to prove the privilege
// boundary from migration 000005 actually holds at the database, not just
// that the GRANT/REVOKE statements ran without error. Ordinary business
// tables still get full CRUD; admin_audit_logs allows INSERT but rejects
// UPDATE and DELETE.
func TestAppRole_AuditLogInsertOnly(t *testing.T) {
	ownerURL := requireDB(t)
	appURL := requireAppDB(t)

	ownerPool, err := pgxpool.New(context.Background(), ownerURL)
	require.NoError(t, err)
	t.Cleanup(ownerPool.Close)

	appPool, err := pgxpool.New(context.Background(), appURL)
	require.NoError(t, err)
	t.Cleanup(appPool.Close)

	ctx := context.Background()

	lineUserID := "test-app-role-actor-" + time.Now().Format("20060102150405.000000000")
	var actorID string
	require.NoError(t, ownerPool.QueryRow(ctx,
		`INSERT INTO users (role, line_user_id, line_display_name) VALUES ('employee', $1, 'App Role Test') RETURNING id::text`,
		lineUserID,
	).Scan(&actorID))
	t.Cleanup(func() {
		_, _ = ownerPool.Exec(ctx, "DELETE FROM admin_audit_logs WHERE actor_id = $1", actorID)
		_, _ = ownerPool.Exec(ctx, "DELETE FROM users WHERE id = $1", actorID)
	})

	// Ordinary table: checkdee_app can read the row the owner role created.
	var gotID string
	require.NoError(t, appPool.QueryRow(ctx, `SELECT id::text FROM users WHERE id = $1`, actorID).Scan(&gotID))
	require.Equal(t, actorID, gotID)

	// admin_audit_logs: INSERT must succeed as checkdee_app.
	var logID string
	err = appPool.QueryRow(ctx,
		`INSERT INTO admin_audit_logs (actor_id, action) VALUES ($1, 'app-role-test') RETURNING id::text`,
		actorID,
	).Scan(&logID)
	require.NoError(t, err, "checkdee_app must be able to INSERT into admin_audit_logs")

	// admin_audit_logs: UPDATE must be rejected by Postgres, not just no-op.
	_, err = appPool.Exec(ctx, `UPDATE admin_audit_logs SET action = 'tampered' WHERE id = $1`, logID)
	require.Error(t, err, "checkdee_app must not be able to UPDATE admin_audit_logs")

	// admin_audit_logs: DELETE must be rejected too.
	_, err = appPool.Exec(ctx, `DELETE FROM admin_audit_logs WHERE id = $1`, logID)
	require.Error(t, err, "checkdee_app must not be able to DELETE from admin_audit_logs")
}

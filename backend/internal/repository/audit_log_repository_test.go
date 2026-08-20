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

func TestAuditLogRepository_CreateListForTarget(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	logs := repository.NewAuditLogRepository(pool)
	ctx := context.Background()

	lineUserID := "test-audit-actor-" + time.Now().Format("20060102150405.000000000")
	actor, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Audit Actor", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM admin_audit_logs WHERE actor_id = $1", actor.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id = $1", actor.ID)
	})

	targetType := "user"
	targetID := actor.ID
	reason := "test correction"

	created, err := logs.Create(ctx, &domain.AdminAuditLog{
		ActorID:    actor.ID,
		Action:     "test.action",
		TargetType: &targetType,
		TargetID:   &targetID,
		Reason:     &reason,
		Metadata:   []byte(`{"field":"status"}`),
	})
	require.NoError(t, err)
	require.NotEmpty(t, created.ID)
	require.Equal(t, "test.action", created.Action)

	list, err := logs.ListForTarget(ctx, targetType, targetID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, created.ID, list[0].ID)
}

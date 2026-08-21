package repository_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

func TestLeaveAttachmentRepository_CreateListGet(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attachment-employee")
	leaves := repository.NewLeaveRequestRepository(pool)
	attachments := repository.NewLeaveAttachmentRepository(pool)
	ctx := context.Background()
	t.Cleanup(func() {
		// leave_attachments rows cascade-delete with their leave_requests
		// row (see migration 000012's ON DELETE CASCADE) — only the parent
		// needs cleaning up.
		_, _ = pool.Exec(ctx, "DELETE FROM leave_requests WHERE employee_id = $1", employee.ID)
	})

	leave, err := leaves.Create(ctx, employee.ID, nil, nil, mustTime(t, "2006-01-02", "2026-08-01"), mustTime(t, "2006-01-02", "2026-08-02"))
	require.NoError(t, err)

	fileBytes := []byte("not a real png, just test bytes")
	created, err := attachments.Create(ctx, leave.ID, employee.ID, "doctor-note.png", "image/png", int64(len(fileBytes)), fileBytes)
	require.NoError(t, err)
	require.Equal(t, "doctor-note.png", created.Filename)
	require.Equal(t, "image/png", created.ContentType)
	require.Equal(t, int64(len(fileBytes)), created.SizeBytes)
	require.Nil(t, created.File, "Create's RETURNING list omits file — see leaveAttachmentMetaColumns")

	list, err := attachments.ListForLeaveRequest(ctx, leave.ID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Nil(t, list[0].File, "ListForLeaveRequest must never load the blob for a list view")

	fetched, err := attachments.Get(ctx, created.ID)
	require.NoError(t, err)
	require.Equal(t, fileBytes, fetched.File, "Get is the only method that loads the actual bytes")
}

func TestLeaveAttachmentRepository_Get_NotFound(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	attachments := repository.NewLeaveAttachmentRepository(pool)
	_, err = attachments.Get(context.Background(), "00000000-0000-0000-0000-000000000000")
	require.ErrorIs(t, err, domain.ErrLeaveAttachmentNotFound)
}

func TestLeaveAttachmentRepository_CascadesOnLeaveRequestDelete(t *testing.T) {
	databaseURL := requireDB(t)
	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	employee := newTestEmployee(t, pool, "test-attachment-cascade-employee")
	leaves := repository.NewLeaveRequestRepository(pool)
	attachments := repository.NewLeaveAttachmentRepository(pool)
	ctx := context.Background()

	leave, err := leaves.Create(ctx, employee.ID, nil, nil, mustTime(t, "2006-01-02", "2026-09-01"), mustTime(t, "2006-01-02", "2026-09-02"))
	require.NoError(t, err)
	created, err := attachments.Create(ctx, leave.ID, employee.ID, "note.pdf", "application/pdf", 4, []byte("test"))
	require.NoError(t, err)

	_, err = pool.Exec(ctx, "DELETE FROM leave_requests WHERE id = $1", leave.ID)
	require.NoError(t, err)

	_, err = attachments.Get(ctx, created.ID)
	require.ErrorIs(t, err, domain.ErrLeaveAttachmentNotFound, "ON DELETE CASCADE must remove attachments with their leave request")
}

package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type LeaveAttachmentRepository struct {
	pool *pgxpool.Pool
}

func NewLeaveAttachmentRepository(pool *pgxpool.Pool) *LeaveAttachmentRepository {
	return &LeaveAttachmentRepository{pool: pool}
}

// leaveAttachmentMetaColumns omits `file` — used by ListForLeaveRequest so a
// list view never loads every blob in a leave request's attachments.
const leaveAttachmentMetaColumns = `
	id::text, leave_request_id::text, uploaded_by::text,
	filename, content_type, size_bytes, created_at`

const leaveAttachmentColumns = leaveAttachmentMetaColumns + `, file`

func scanLeaveAttachmentMeta(row pgx.Row) (*domain.LeaveAttachment, error) {
	var a domain.LeaveAttachment
	err := row.Scan(
		&a.ID, &a.LeaveRequestID, &a.UploadedBy,
		&a.Filename, &a.ContentType, &a.SizeBytes, &a.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func scanLeaveAttachment(row pgx.Row) (*domain.LeaveAttachment, error) {
	var a domain.LeaveAttachment
	err := row.Scan(
		&a.ID, &a.LeaveRequestID, &a.UploadedBy,
		&a.Filename, &a.ContentType, &a.SizeBytes, &a.CreatedAt,
		&a.File,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *LeaveAttachmentRepository) Create(ctx context.Context, leaveRequestID, uploadedBy, filename, contentType string, sizeBytes int64, file []byte) (*domain.LeaveAttachment, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO leave_attachments (leave_request_id, uploaded_by, filename, content_type, size_bytes, file)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+leaveAttachmentMetaColumns,
		leaveRequestID, uploadedBy, filename, contentType, sizeBytes, file,
	)
	return scanLeaveAttachmentMeta(row)
}

func (r *LeaveAttachmentRepository) ListForLeaveRequest(ctx context.Context, leaveRequestID string) ([]*domain.LeaveAttachment, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+leaveAttachmentMetaColumns+`
		FROM leave_attachments
		WHERE leave_request_id = $1
		ORDER BY created_at`,
		leaveRequestID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.LeaveAttachment
	for rows.Next() {
		a, err := scanLeaveAttachmentMeta(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *LeaveAttachmentRepository) Get(ctx context.Context, id string) (*domain.LeaveAttachment, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+leaveAttachmentColumns+` FROM leave_attachments WHERE id = $1`, id)
	a, err := scanLeaveAttachment(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrLeaveAttachmentNotFound
	}
	return a, err
}

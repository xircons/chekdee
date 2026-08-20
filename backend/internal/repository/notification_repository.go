package repository

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type NotificationRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{pool: pool}
}

const notificationColumns = `
	id::text, recipient_id::text, type, title, body, metadata, read_at, created_at`

func scanNotification(row pgx.Row) (*domain.Notification, error) {
	var n domain.Notification
	err := row.Scan(&n.ID, &n.RecipientID, &n.Type, &n.Title, &n.Body, &n.Metadata, &n.ReadAt, &n.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *NotificationRepository) Create(ctx context.Context, recipientID, notifType, title string, body *string, metadata any) error {
	var metaJSON []byte
	if metadata != nil {
		encoded, err := json.Marshal(metadata)
		if err != nil {
			return err
		}
		metaJSON = encoded
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO notifications (recipient_id, type, title, body, metadata)
		VALUES ($1, $2, $3, $4, $5)`,
		recipientID, notifType, title, body, metaJSON,
	)
	return err
}

func (r *NotificationRepository) ListForRecipient(ctx context.Context, recipientID string, unreadOnly bool) ([]*domain.Notification, error) {
	query := `SELECT ` + notificationColumns + ` FROM notifications WHERE recipient_id = $1`
	if unreadOnly {
		query += ` AND read_at IS NULL`
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, recipientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Notification
	for rows.Next() {
		n, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *NotificationRepository) MarkRead(ctx context.Context, id, recipientID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE notifications SET read_at = now()
		WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL`,
		id, recipientID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotificationNotFound
	}
	return nil
}

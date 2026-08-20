package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

const pgUniqueViolation = "23505"

type QRNonceRepository struct {
	pool *pgxpool.Pool
}

func NewQRNonceRepository(pool *pgxpool.Pool) *QRNonceRepository {
	return &QRNonceRepository{pool: pool}
}

func (r *QRNonceRepository) Consume(ctx context.Context, nonce, deviceID string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO consumed_qr_nonces (nonce, device_id, expires_at)
		VALUES ($1, $2, $3)`,
		nonce, deviceID, expiresAt,
	)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
		return domain.ErrNonceAlreadyConsumed
	}
	return err
}

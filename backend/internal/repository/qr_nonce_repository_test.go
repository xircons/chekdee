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

func TestQRNonceRepository_Consume_RejectsReplay(t *testing.T) {
	databaseURL := requireDB(t)

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	nonces := repository.NewQRNonceRepository(pool)
	ctx := context.Background()

	nonce := "test-nonce-" + time.Now().Format("20060102150405.000000000")
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM consumed_qr_nonces WHERE nonce = $1", nonce)
	})

	require.NoError(t, nonces.Consume(ctx, nonce, "00000000-0000-0000-0000-000000000001", time.Now().Add(15*time.Second)))

	err = nonces.Consume(ctx, nonce, "00000000-0000-0000-0000-000000000001", time.Now().Add(15*time.Second))
	require.ErrorIs(t, err, domain.ErrNonceAlreadyConsumed, "a second consume of the same nonce must be rejected as a replay")
}

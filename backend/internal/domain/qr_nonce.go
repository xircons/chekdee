package domain

import (
	"context"
	"errors"
	"time"
)

// ErrNonceAlreadyConsumed means the QR nonce was already used — a
// photographed QR relayed to a second phone within its 15s window, or a
// simple double-scan. Rejected, not retried: a fresh QR is needed.
var ErrNonceAlreadyConsumed = errors.New("qr nonce already consumed")

type QRNonceRepository interface {
	// Consume records nonce as used, returning ErrNonceAlreadyConsumed on
	// replay (the nonce is the table's primary key).
	Consume(ctx context.Context, nonce, deviceID string, expiresAt time.Time) error
}

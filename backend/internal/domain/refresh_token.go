package domain

import (
	"context"
	"errors"
	"time"
)

var ErrRefreshTokenInvalid = errors.New("refresh token invalid or expired")

type RefreshToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	RevokedAt *time.Time
}

type RefreshTokenRepository interface {
	Create(ctx context.Context, userID, tokenHash, userAgent, ipAddress string, expiresAt time.Time) error
	GetActive(ctx context.Context, tokenHash string) (*RefreshToken, error)
	Revoke(ctx context.Context, tokenHash string) error
	RevokeAllForUser(ctx context.Context, userID string) error
}

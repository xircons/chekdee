package domain

import (
	"context"
	"errors"
	"time"
)

var ErrKioskDeviceNotFound = errors.New("kiosk device not found")

// KioskDevice is one token issuance for a physical TV/screen. device_id is
// the screen's stable identity across rotations; each row is immutable —
// rotate/revoke never edit a row in place, see the migration comment.
type KioskDevice struct {
	ID        string
	DeviceID  string
	Name      string
	TokenHash string
	CreatedBy *string
	RevokedAt *time.Time
	CreatedAt time.Time
}

func (k *KioskDevice) IsActive() bool {
	return k.RevokedAt == nil
}

type KioskDeviceRepository interface {
	// Create mints a brand-new device identity and its first token.
	Create(ctx context.Context, name, tokenHash, createdBy string) (*KioskDevice, error)
	// Rotate revokes the current active token for deviceID and inserts a new
	// row with a fresh token in the same transaction, so the device is never
	// briefly tokenless.
	Rotate(ctx context.Context, deviceID, newTokenHash string) (*KioskDevice, error)
	Revoke(ctx context.Context, deviceID string) error
	GetActiveByTokenHash(ctx context.Context, tokenHash string) (*KioskDevice, error)
	// GetActiveByDeviceID looks up by the stable device_id embedded in a QR
	// payload — a check-in request never presents the device's own token.
	GetActiveByDeviceID(ctx context.Context, deviceID string) (*KioskDevice, error)
	// ListActive returns the current active row per device (one per screen).
	ListActive(ctx context.Context) ([]*KioskDevice, error)
}

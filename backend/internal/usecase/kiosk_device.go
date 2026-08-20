package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"

	"checkdee-backend/internal/domain"
)

type KioskDeviceUsecase struct {
	devices domain.KioskDeviceRepository
}

func NewKioskDeviceUsecase(devices domain.KioskDeviceRepository) *KioskDeviceUsecase {
	return &KioskDeviceUsecase{devices: devices}
}

// Create mints a device and its first token. The raw token is only ever
// returned here and from Rotate — every other read gets it masked.
func (k *KioskDeviceUsecase) Create(ctx context.Context, name, createdBy string) (device *domain.KioskDevice, rawToken string, err error) {
	rawToken, hash, err := generateDeviceToken()
	if err != nil {
		return nil, "", err
	}
	device, err = k.devices.Create(ctx, name, hash, createdBy)
	return device, rawToken, err
}

func (k *KioskDeviceUsecase) Rotate(ctx context.Context, deviceID string) (device *domain.KioskDevice, rawToken string, err error) {
	rawToken, hash, err := generateDeviceToken()
	if err != nil {
		return nil, "", err
	}
	device, err = k.devices.Rotate(ctx, deviceID, hash)
	return device, rawToken, err
}

func (k *KioskDeviceUsecase) Revoke(ctx context.Context, deviceID string) error {
	return k.devices.Revoke(ctx, deviceID)
}

func (k *KioskDeviceUsecase) ListActive(ctx context.Context) ([]*domain.KioskDevice, error) {
	return k.devices.ListActive(ctx)
}

func (k *KioskDeviceUsecase) ListAll(ctx context.Context) ([]*domain.KioskDevice, error) {
	return k.devices.ListAll(ctx)
}

// VerifyToken looks up the device by a presented raw token, for the kiosk
// (device-authenticated, not user-JWT-authenticated) routes.
func (k *KioskDeviceUsecase) VerifyToken(ctx context.Context, rawToken string) (*domain.KioskDevice, error) {
	return k.devices.GetActiveByTokenHash(ctx, hashDeviceToken(rawToken))
}

func generateDeviceToken() (raw string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(buf)
	return raw, hashDeviceToken(raw), nil
}

func hashDeviceToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

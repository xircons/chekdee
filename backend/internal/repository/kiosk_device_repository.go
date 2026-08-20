package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type KioskDeviceRepository struct {
	pool *pgxpool.Pool
}

func NewKioskDeviceRepository(pool *pgxpool.Pool) *KioskDeviceRepository {
	return &KioskDeviceRepository{pool: pool}
}

const kioskDeviceColumns = `
	id::text, device_id::text, name, token_hash, created_by::text, revoked_at, created_at`

func scanKioskDevice(row pgx.Row) (*domain.KioskDevice, error) {
	var d domain.KioskDevice
	err := row.Scan(&d.ID, &d.DeviceID, &d.Name, &d.TokenHash, &d.CreatedBy, &d.RevokedAt, &d.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *KioskDeviceRepository) Create(ctx context.Context, name, tokenHash, createdBy string) (*domain.KioskDevice, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO kiosk_devices (device_id, name, token_hash, created_by)
		VALUES (gen_random_uuid(), $1, $2, $3)
		RETURNING `+kioskDeviceColumns,
		name, tokenHash, createdBy,
	)
	return scanKioskDevice(row)
}

// Rotate revokes the current active row for deviceID and inserts a new one
// with a fresh token, in one transaction — the device is never briefly
// tokenless, and history stays queryable (see the migration comment).
func (r *KioskDeviceRepository) Rotate(ctx context.Context, deviceID, newTokenHash string) (*domain.KioskDevice, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var name string
	var createdBy *string
	err = tx.QueryRow(ctx, `
		UPDATE kiosk_devices SET revoked_at = now()
		WHERE device_id = $1 AND revoked_at IS NULL
		RETURNING name, created_by::text`,
		deviceID,
	).Scan(&name, &createdBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrKioskDeviceNotFound
	}
	if err != nil {
		return nil, err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO kiosk_devices (device_id, name, token_hash, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING `+kioskDeviceColumns,
		deviceID, name, newTokenHash, createdBy,
	)
	rotated, err := scanKioskDevice(row)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return rotated, nil
}

func (r *KioskDeviceRepository) Revoke(ctx context.Context, deviceID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE kiosk_devices SET revoked_at = now()
		WHERE device_id = $1 AND revoked_at IS NULL`,
		deviceID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrKioskDeviceNotFound
	}
	return nil
}

func (r *KioskDeviceRepository) GetActiveByTokenHash(ctx context.Context, tokenHash string) (*domain.KioskDevice, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+kioskDeviceColumns+`
		FROM kiosk_devices
		WHERE token_hash = $1 AND revoked_at IS NULL`,
		tokenHash,
	)
	d, err := scanKioskDevice(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrKioskDeviceNotFound
	}
	return d, err
}

func (r *KioskDeviceRepository) GetActiveByDeviceID(ctx context.Context, deviceID string) (*domain.KioskDevice, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+kioskDeviceColumns+`
		FROM kiosk_devices
		WHERE device_id = $1 AND revoked_at IS NULL`,
		deviceID,
	)
	d, err := scanKioskDevice(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrKioskDeviceNotFound
	}
	return d, err
}

func (r *KioskDeviceRepository) ListActive(ctx context.Context) ([]*domain.KioskDevice, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+kioskDeviceColumns+`
		FROM kiosk_devices
		WHERE revoked_at IS NULL
		ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.KioskDevice
	for rows.Next() {
		d, err := scanKioskDevice(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// ListAll returns the latest row per device_id (DISTINCT ON), whether that
// row is active or revoked — a rotated device has multiple historical rows
// sharing one device_id, and only the newest reflects its current state.
func (r *KioskDeviceRepository) ListAll(ctx context.Context) ([]*domain.KioskDevice, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+kioskDeviceColumns+` FROM (
			SELECT DISTINCT ON (device_id) `+kioskDeviceColumns+`
			FROM kiosk_devices
			ORDER BY device_id, created_at DESC
		) latest
		ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.KioskDevice
	for rows.Next() {
		d, err := scanKioskDevice(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

// UserRepository implements domain.UserRepository against Postgres.
//
// This is hand-written pgx rather than sqlc-generated code: db/queries
// already defines the intended query surface for sqlc, but `sqlc generate`
// hasn't been run yet in this environment. Once it has (`make sqlc`),
// this file can be slimmed down to delegate to the generated Queries
// struct instead of building SQL by hand.
type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

const userColumns = `
	id::text, role::text, status::text, team_id::text,
	line_user_id, line_display_name, line_picture_url,
	username, password_hash, first_name, last_name, student_gen,
	registration_completed_at,
	offboarded_at, offboarded_by::text, offboarded_reason,
	created_at, updated_at`

func scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	var role, status string

	err := row.Scan(
		&u.ID, &role, &status, &u.TeamID,
		&u.LineUserID, &u.LineDisplayName, &u.LinePictureURL,
		&u.Username, &u.PasswordHash, &u.FirstName, &u.LastName, &u.StudentGen,
		&u.RegistrationCompletedAt,
		&u.OffboardedAt, &u.OffboardedBy, &u.OffboardedReason,
		&u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	u.Role = domain.Role(role)
	u.Status = domain.UserStatus(status)
	return &u, nil
}

func (r *UserRepository) GetByLineUserID(ctx context.Context, lineUserID string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE line_user_id = $1`, lineUserID)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	return u, err
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	return u, err
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE username = $1`, username)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	return u, err
}

func (r *UserRepository) CreateEmployeeFromLine(ctx context.Context, lineUserID, displayName, pictureURL string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO users (role, line_user_id, line_display_name, line_picture_url)
		VALUES ('employee', $1, $2, $3)
		RETURNING `+userColumns,
		lineUserID, displayName, pictureURL,
	)
	return scanUser(row)
}

func (r *UserRepository) UpdateLineProfile(ctx context.Context, id, displayName, pictureURL string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET line_display_name = $2, line_picture_url = $3, updated_at = now()
		WHERE id = $1`,
		id, displayName, pictureURL,
	)
	return err
}

func (r *UserRepository) CompleteRegistration(ctx context.Context, id, firstName, lastName, studentGen string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE users
		SET first_name = $2, last_name = $3, student_gen = $4,
		    registration_completed_at = now(), updated_at = now()
		WHERE id = $1
		RETURNING `+userColumns,
		id, firstName, lastName, studentGen,
	)
	return scanUser(row)
}

func (r *UserRepository) CreateSystemOwner(ctx context.Context, username, passwordHash string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO users (role, username, password_hash)
		VALUES ('system_owner', $1, $2)
		RETURNING `+userColumns,
		username, passwordHash,
	)
	return scanUser(row)
}

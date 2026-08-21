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
	student_id, phone_number, project, email,
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
		&u.StudentID, &u.PhoneNumber, &u.Project, &u.Email,
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

func (r *UserRepository) CompleteRegistration(ctx context.Context, id, firstName, lastName, studentGen string, studentID, phoneNumber, project, email *string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE users
		SET first_name = $2, last_name = $3, student_gen = $4,
		    student_id = $5, phone_number = $6, project = $7, email = $8,
		    registration_completed_at = now(), updated_at = now()
		WHERE id = $1
		RETURNING `+userColumns,
		id, firstName, lastName, studentGen, studentID, phoneNumber, project, email,
	)
	return scanUser(row)
}

func (r *UserRepository) ListActiveEmployees(ctx context.Context) ([]*domain.User, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+userColumns+`
		FROM users
		WHERE role = 'employee' AND offboarded_at IS NULL
		ORDER BY first_name, last_name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
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

// employeeListWhere is shared between List's row query and its count query
// so the two can never drift out of sync with each other.
const employeeListWhere = `
	($1::uuid IS NULL OR team_id = $1)
	AND ($2::text IS NULL OR role::text = $2)
	AND (
		$3::text IS NULL
		OR ($3 = 'active' AND offboarded_at IS NULL)
		OR ($3 = 'offboarded' AND offboarded_at IS NOT NULL)
	)
	AND (
		$4::text IS NULL
		OR first_name ILIKE '%' || $4 || '%'
		OR last_name ILIKE '%' || $4 || '%'
		OR line_display_name ILIKE '%' || $4 || '%'
	)`

// List is the employee-directory listing behind GET /employees.
func (r *UserRepository) List(ctx context.Context, filter domain.EmployeeListFilter) ([]*domain.User, int, error) {
	var role *string
	if filter.Role != nil {
		s := string(*filter.Role)
		role = &s
	}
	var search *string
	if filter.Search != "" {
		search = &filter.Search
	}

	var total int
	if err := r.pool.QueryRow(ctx, `
		SELECT count(*) FROM users WHERE `+employeeListWhere,
		filter.TeamID, role, filter.OffboardStatus, search,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT `+userColumns+`
		FROM users
		WHERE `+employeeListWhere+`
		ORDER BY first_name, last_name
		LIMIT $5 OFFSET $6`,
		filter.TeamID, role, filter.OffboardStatus, search, filter.Limit, filter.Offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []*domain.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, u)
	}
	return out, total, rows.Err()
}

// Update edits profile fields only — see the interface doc comment for why
// role/offboarding are separate methods.
func (r *UserRepository) Update(ctx context.Context, id string, firstName, lastName, teamID, studentGen, studentID, phoneNumber, project, email *string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `
		UPDATE users
		SET first_name = $2, last_name = $3, team_id = $4::uuid,
		    student_gen = $5, student_id = $6, phone_number = $7,
		    project = $8, email = $9, updated_at = now()
		WHERE id = $1
		RETURNING `+userColumns,
		id, firstName, lastName, teamID, studentGen, studentID, phoneNumber, project, email,
	)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	return u, err
}

// getByIDTx is GetByID run inside an already-open transaction, so the
// disambiguating re-check in UpdateRole/Offboard below sees a consistent
// view with the UPDATE that just ran in the same tx.
func getByIDTx(ctx context.Context, tx pgx.Tx, id string) (*domain.User, error) {
	row := tx.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	return u, err
}

// UpdateRole and the audit log entry commit together or not at all — see
// the interface doc comment. WHERE role <> 'system_owner' is a DB-level
// backstop against a race between the usecase's own system_owner check and
// this write; 0 rows matched is disambiguated below into not-found vs.
// still-system_owner (there is no third possibility for UpdateRole, unlike
// Offboard's extra "already offboarded" case).
func (r *UserRepository) UpdateRole(ctx context.Context, id string, role domain.Role, auditEntry *domain.AdminAuditLog) (*domain.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	row := tx.QueryRow(ctx, `
		UPDATE users SET role = $2, updated_at = now()
		WHERE id = $1 AND role <> 'system_owner'
		RETURNING `+userColumns,
		id, string(role),
	)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		existing, getErr := getByIDTx(ctx, tx, id)
		if getErr != nil {
			return nil, getErr
		}
		if existing.Role == domain.RoleSystemOwner {
			return nil, domain.ErrCannotModifySystemOwnerRole
		}
		return nil, domain.ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	if _, err := insertAuditLog(ctx, tx, auditEntry); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return u, nil
}

// Offboard soft-deletes a user and writes the audit log entry in the same
// transaction. WHERE role <> 'system_owner' is the same DB-level backstop
// UpdateRole has; 0 rows matched is disambiguated below into not-found,
// still-system_owner, or already-offboarded — the same three-way split
// LeaveRequestRepository.Decide does for "not pending anymore" vs.
// "doesn't exist".
func (r *UserRepository) Offboard(ctx context.Context, id string, reason *string, auditEntry *domain.AdminAuditLog) (*domain.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	row := tx.QueryRow(ctx, `
		UPDATE users
		SET offboarded_at = now(), offboarded_by = $2, offboarded_reason = $3, updated_at = now()
		WHERE id = $1 AND offboarded_at IS NULL AND role <> 'system_owner'
		RETURNING `+userColumns,
		id, auditEntry.ActorID, reason,
	)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		existing, getErr := getByIDTx(ctx, tx, id)
		if getErr != nil {
			return nil, getErr
		}
		if existing.Role == domain.RoleSystemOwner {
			return nil, domain.ErrCannotOffboardSystemOwner
		}
		if existing.OffboardedAt != nil {
			return nil, domain.ErrUserAlreadyOffboarded
		}
		return nil, domain.ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	if _, err := insertAuditLog(ctx, tx, auditEntry); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return u, nil
}

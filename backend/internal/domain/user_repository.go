package domain

import "context"

// EmployeeListFilter narrows List's results. All fields are optional
// (nil/empty means unfiltered). OffboardStatus is distinct from the
// User.Status column (active/inactive) — it filters on offboarded_at
// IS [NOT] NULL, values "active" or "offboarded".
type EmployeeListFilter struct {
	TeamID         *string
	Role           *Role
	OffboardStatus *string
	Search         string
	Limit          int
	Offset         int
}

// UserRepository is implemented by the repository package. Usecases depend
// only on this interface, never on a concrete storage type.
type UserRepository interface {
	GetByLineUserID(ctx context.Context, lineUserID string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
	GetByUsername(ctx context.Context, username string) (*User, error)
	CreateEmployeeFromLine(ctx context.Context, lineUserID, displayName, pictureURL string) (*User, error)
	UpdateLineProfile(ctx context.Context, id, displayName, pictureURL string) error
	CompleteRegistration(ctx context.Context, id, firstName, lastName, studentGen string) (*User, error)
	CreateSystemOwner(ctx context.Context, username, passwordHash string) (*User, error)
	// ListActiveEmployees returns every non-offboarded employee — the
	// roster the monthly report iterates over.
	ListActiveEmployees(ctx context.Context) ([]*User, error)

	// List is the employee-directory listing behind GET /employees —
	// filterable and paginated, unlike ListActiveEmployees above (which is
	// role-locked to "employee" and exists only to feed the report).
	List(ctx context.Context, filter EmployeeListFilter) ([]*User, int, error)
	// Update edits profile fields only (first_name, last_name, team_id).
	// Never touches role, username, password_hash, or offboarded_* — those
	// go through UpdateRole / Offboard, which are distinct, more sensitive
	// actions with their own audit-log entries.
	Update(ctx context.Context, id string, firstName, lastName, teamID *string) (*User, error)
	// UpdateRole changes a user's role. System_owner transitions are
	// rejected at the usecase level, not here.
	UpdateRole(ctx context.Context, id string, role Role) (*User, error)
	// Offboard soft-deletes a user (offboarded_at/by/reason) — see
	// design.md: users are never hard-deleted. Rejects a user who is
	// already offboarded.
	Offboard(ctx context.Context, id, offboardedBy string, reason *string) (*User, error)
}

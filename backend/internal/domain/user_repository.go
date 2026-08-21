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
	CompleteRegistration(ctx context.Context, id, firstName, lastName, studentGen string, studentID, phoneNumber, project, email *string) (*User, error)
	CreateSystemOwner(ctx context.Context, username, passwordHash string) (*User, error)
	// ListActiveEmployees returns every non-offboarded employee — the
	// roster the monthly report iterates over.
	ListActiveEmployees(ctx context.Context) ([]*User, error)

	// List is the employee-directory listing behind GET /employees —
	// filterable and paginated, unlike ListActiveEmployees above (which is
	// role-locked to "employee" and exists only to feed the report).
	List(ctx context.Context, filter EmployeeListFilter) ([]*User, int, error)
	// Update edits profile fields only (first_name, last_name, team_id,
	// student_gen, student_id, phone_number, project, email). Never touches
	// role, username, password_hash, or offboarded_* — those go through
	// UpdateRole / Offboard, which are distinct, more sensitive actions with
	// their own audit-log entries. Best-effort audited by the caller
	// (usecase), not transactional — see UpdateRole/Offboard below for why
	// those two are different.
	Update(ctx context.Context, id string, firstName, lastName, teamID, studentGen, studentID, phoneNumber, project, email *string) (*User, error)
	// UpdateRole changes a user's role and writes auditEntry in the same
	// transaction as the UPDATE, so a privilege change can never commit
	// without its audit trail (or vice versa). The usecase layer owns the
	// actor-outranks-target rank check and the to/from-system_owner check;
	// this method re-asserts "target is not system_owner" at the SQL level
	// (WHERE role <> 'system_owner') as a backstop against a race between
	// the usecase's check and this write, surfaced as
	// ErrCannotModifySystemOwnerRole if that backstop is what actually
	// blocked the update.
	UpdateRole(ctx context.Context, id string, role Role, auditEntry *AdminAuditLog) (*User, error)
	// Offboard soft-deletes a user (offboarded_at/by/reason, offboarded_by
	// taken from auditEntry.ActorID) and writes auditEntry in the same
	// transaction — see design.md: users are never hard-deleted. Rejects a
	// user who is already offboarded, and re-asserts "target is not
	// system_owner" at the SQL level the same way UpdateRole does.
	Offboard(ctx context.Context, id string, reason *string, auditEntry *AdminAuditLog) (*User, error)
}

package usecase

import (
	"context"

	"checkdee-backend/internal/domain"
)

// DefaultEmployeeListLimit/MaxEmployeeListLimit bound GET /employees's
// limit query param — unset or non-positive falls back to the default,
// anything above the max is clamped rather than rejected.
const (
	DefaultEmployeeListLimit = 50
	MaxEmployeeListLimit     = 200
)

// EmployeeUsecase is the employee-directory read/write layer behind
// GET/PATCH /employees — a thin wrapper over UserRepository's directory
// methods, plus the system_owner-protection rules and audit logging that
// don't belong in the repository.
type EmployeeUsecase struct {
	users domain.UserRepository
	audit *AuditLogUsecase
}

func NewEmployeeUsecase(users domain.UserRepository, audit *AuditLogUsecase) *EmployeeUsecase {
	return &EmployeeUsecase{users: users, audit: audit}
}

func (e *EmployeeUsecase) List(ctx context.Context, filter domain.EmployeeListFilter) ([]*domain.User, int, error) {
	if filter.Limit <= 0 {
		filter.Limit = DefaultEmployeeListLimit
	}
	if filter.Limit > MaxEmployeeListLimit {
		filter.Limit = MaxEmployeeListLimit
	}
	return e.users.List(ctx, filter)
}

func (e *EmployeeUsecase) GetByID(ctx context.Context, id string) (*domain.User, error) {
	return e.users.GetByID(ctx, id)
}

// Update edits profile fields only. Logs "employee.update" — see Update on
// UserRepository for why role/offboarding go through separate methods.
func (e *EmployeeUsecase) Update(ctx context.Context, actorID, id string, firstName, lastName, teamID *string) (*domain.User, error) {
	updated, err := e.users.Update(ctx, id, firstName, lastName, teamID)
	if err != nil {
		return nil, err
	}

	targetType := "user"
	// Best-effort, matching LeaveUsecase.Decide's framing — the edit
	// already committed, so a lost audit entry is a lesser failure than
	// reverting a change the caller already saw succeed.
	_ = e.audit.Log(ctx, actorID, "employee.update", &targetType, &id, nil, nil)
	return updated, nil
}

// UpdateRole changes a user's role, rejecting any transition to or from
// system_owner — that account is bootstrapped out-of-band via
// cmd/seedowner only (see auth.go), never promoted/demoted through this
// API. Logs "employee.update_role".
func (e *EmployeeUsecase) UpdateRole(ctx context.Context, actorID, id string, role domain.Role) (*domain.User, error) {
	if role == domain.RoleSystemOwner {
		return nil, domain.ErrCannotModifySystemOwnerRole
	}

	current, err := e.users.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current.Role == domain.RoleSystemOwner {
		return nil, domain.ErrCannotModifySystemOwnerRole
	}

	updated, err := e.users.UpdateRole(ctx, id, role)
	if err != nil {
		return nil, err
	}

	targetType := "user"
	_ = e.audit.Log(ctx, actorID, "employee.update_role", &targetType, &id, nil, map[string]string{
		"from_role": string(current.Role),
		"to_role":   string(role),
	})
	return updated, nil
}

// Offboard soft-deletes a user, rejecting a system_owner target and
// (via UserRepository.Offboard's own guard) an already-offboarded one.
// Logs "employee.offboard" with the reason.
func (e *EmployeeUsecase) Offboard(ctx context.Context, actorID, id string, reason *string) (*domain.User, error) {
	current, err := e.users.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current.Role == domain.RoleSystemOwner {
		return nil, domain.ErrCannotOffboardSystemOwner
	}

	offboarded, err := e.users.Offboard(ctx, id, actorID, reason)
	if err != nil {
		return nil, err
	}

	targetType := "user"
	_ = e.audit.Log(ctx, actorID, "employee.offboard", &targetType, &id, reason, nil)
	return offboarded, nil
}

package usecase

import (
	"context"
	"encoding/json"

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
// methods, plus the system_owner-protection and role-rank rules that don't
// belong in the repository.
type EmployeeUsecase struct {
	users domain.UserRepository
	audit *AuditLogUsecase
}

func NewEmployeeUsecase(users domain.UserRepository, audit *AuditLogUsecase) *EmployeeUsecase {
	return &EmployeeUsecase{users: users, audit: audit}
}

// roleRank orders roles for the "actor must outrank target" checks in
// UpdateRole/Offboard below. Higher is more privileged.
func roleRank(role domain.Role) int {
	switch role {
	case domain.RoleEmployee:
		return 0
	case domain.RoleSupervisor:
		return 1
	case domain.RoleAdmin:
		return 2
	case domain.RoleSystemOwner:
		return 3
	default:
		return -1
	}
}

func (e *EmployeeUsecase) List(ctx context.Context, filter domain.EmployeeListFilter) ([]*domain.User, int, error) {
	if filter.Limit <= 0 {
		filter.Limit = DefaultEmployeeListLimit
	}
	if filter.Limit > MaxEmployeeListLimit {
		filter.Limit = MaxEmployeeListLimit
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	return e.users.List(ctx, filter)
}

func (e *EmployeeUsecase) GetByID(ctx context.Context, id string) (*domain.User, error) {
	return e.users.GetByID(ctx, id)
}

// Update edits profile fields only. Logs "employee.update" — see Update on
// UserRepository for why role/offboarding go through separate methods.
func (e *EmployeeUsecase) Update(ctx context.Context, actorID, id string, firstName, lastName, teamID, studentGen, studentID, phoneNumber, project, email *string) (*domain.User, error) {
	updated, err := e.users.Update(ctx, id, firstName, lastName, teamID, studentGen, studentID, phoneNumber, project, email)
	if err != nil {
		return nil, err
	}

	targetType := "user"
	// Best-effort, matching LeaveUsecase.Decide's framing — the edit
	// already committed, so a lost audit entry is a lesser failure than
	// reverting a change the caller already saw succeed. Unlike
	// UpdateRole/Offboard below, a profile edit isn't privilege-sensitive
	// enough to need transactional atomicity with its audit entry.
	_ = e.audit.Log(ctx, actorID, "employee.update", &targetType, &id, nil, nil)
	return updated, nil
}

// UpdateRole changes a user's role, rejecting:
//   - any transition to or from system_owner (bootstrapped out-of-band via
//     cmd/seedowner only, see auth.go — never promoted/demoted here)
//   - self-role-change (an actor can never outrank themselves, so this is
//     also implied by the rank check below, but checked explicitly first)
//   - an actor who does not strictly outrank both the target's current role
//     and the requested new role (a supervisor can never grant admin or
//     supervisor to anyone, only admin/system_owner can)
//
// The mutation and its audit log entry commit atomically — see
// UserRepository.UpdateRole.
func (e *EmployeeUsecase) UpdateRole(ctx context.Context, actorID, id string, role domain.Role) (*domain.User, error) {
	if role == domain.RoleSystemOwner {
		return nil, domain.ErrCannotModifySystemOwnerRole
	}
	if actorID == id {
		return nil, domain.ErrInsufficientRole
	}

	// Target fetched before actor: a target-specific rejection (not found,
	// or target is system_owner) doesn't need to know who the actor is.
	// The actor is already role-gated at the route level (RequireRole); this
	// fetch is only for the rank comparison below, not authentication.
	current, err := e.users.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current.Role == domain.RoleSystemOwner {
		return nil, domain.ErrCannotModifySystemOwnerRole
	}

	actor, err := e.users.GetByID(ctx, actorID)
	if err != nil {
		return nil, err
	}

	actorRank := roleRank(actor.Role)
	if actorRank <= roleRank(current.Role) || actorRank <= roleRank(role) {
		return nil, domain.ErrInsufficientRole
	}

	metadata, err := json.Marshal(map[string]string{
		"from_role": string(current.Role),
		"to_role":   string(role),
	})
	if err != nil {
		return nil, err
	}

	targetType := "user"
	return e.users.UpdateRole(ctx, id, role, &domain.AdminAuditLog{
		ActorID:    actorID,
		Action:     "employee.update_role",
		TargetType: &targetType,
		TargetID:   &id,
		Metadata:   metadata,
	})
}

// Offboard soft-deletes a user, rejecting:
//   - a system_owner target
//   - self-offboard (also implied by the rank check below, checked
//     explicitly first)
//   - an actor who does not strictly outrank the target's current role
//
// (via UserRepository.Offboard's own guard) an already-offboarded target.
// The mutation and its audit log entry commit atomically — see
// UserRepository.Offboard.
func (e *EmployeeUsecase) Offboard(ctx context.Context, actorID, id string, reason *string) (*domain.User, error) {
	if actorID == id {
		return nil, domain.ErrInsufficientRole
	}

	current, err := e.users.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current.Role == domain.RoleSystemOwner {
		return nil, domain.ErrCannotOffboardSystemOwner
	}

	actor, err := e.users.GetByID(ctx, actorID)
	if err != nil {
		return nil, err
	}
	if roleRank(actor.Role) <= roleRank(current.Role) {
		return nil, domain.ErrInsufficientRole
	}

	targetType := "user"
	return e.users.Offboard(ctx, id, reason, &domain.AdminAuditLog{
		ActorID:    actorID,
		Action:     "employee.offboard",
		TargetType: &targetType,
		TargetID:   &id,
		Reason:     reason,
	})
}

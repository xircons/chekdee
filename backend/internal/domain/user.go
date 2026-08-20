package domain

import (
	"errors"
	"time"
)

type Role string

const (
	RoleSystemOwner Role = "system_owner"
	RoleAdmin       Role = "admin"
	RoleSupervisor  Role = "supervisor"
	RoleEmployee    Role = "employee"
)

type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusInactive UserStatus = "inactive"
)

var (
	ErrUserNotFound          = errors.New("user not found")
	ErrUserAlreadyOffboarded = errors.New("user already offboarded")
	// ErrCannotModifySystemOwnerRole guards both directions: a system_owner's
	// role can't be changed away from system_owner, and no other role can be
	// promoted to it — system_owner is bootstrapped out-of-band via
	// cmd/seedowner only (see auth.go's password-login path), never through
	// the employee-directory API.
	ErrCannotModifySystemOwnerRole = errors.New("cannot change role to or from system_owner")
	ErrCannotOffboardSystemOwner   = errors.New("cannot offboard system_owner")
	// ErrInsufficientRole guards rank: an actor can only change another
	// user's role, or offboard them, if the actor strictly outranks both
	// the target's current role and (for a role change) the requested new
	// role. Also covers the self-action case (an actor never outranks
	// themselves) — see EmployeeUsecase.UpdateRole/Offboard.
	ErrInsufficientRole = errors.New("insufficient role to perform this action")
)

type User struct {
	ID     string
	Role   Role
	Status UserStatus
	TeamID *string

	LineUserID      *string
	LineDisplayName *string
	LinePictureURL  *string

	Username     *string
	PasswordHash *string

	FirstName  *string
	LastName   *string
	StudentGen *string

	RegistrationCompletedAt *time.Time

	OffboardedAt     *time.Time
	OffboardedBy     *string
	OffboardedReason *string

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (u *User) IsRegistered() bool {
	return u.RegistrationCompletedAt != nil
}

func (u *User) IsActive() bool {
	return u.Status == UserStatusActive && u.OffboardedAt == nil
}

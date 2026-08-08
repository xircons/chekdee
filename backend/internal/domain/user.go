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

var ErrUserNotFound = errors.New("user not found")

type User struct {
	ID     string
	Role   Role
	Status UserStatus
	TeamID *string

	LineUserID      *string
	LineDisplayName *string
	LinePictureURL  *string

	Username *string

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

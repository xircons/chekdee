package domain

import "context"

// UserRepository is implemented by the repository package. Usecases depend
// only on this interface, never on a concrete storage type.
type UserRepository interface {
	GetByLineUserID(ctx context.Context, lineUserID string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
	GetByUsername(ctx context.Context, username string) (*User, error)
	CreateEmployeeFromLine(ctx context.Context, lineUserID, displayName, pictureURL string) (*User, error)
	UpdateLineProfile(ctx context.Context, id, displayName, pictureURL string) error
	CompleteRegistration(ctx context.Context, id, firstName, lastName, studentGen string) (*User, error)
}

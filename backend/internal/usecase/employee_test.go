package usecase_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type fakeEmployeeRepo struct {
	users map[string]*domain.User

	listCalls       int
	lastListFilter  domain.EmployeeListFilter
	updateCalls     int
	updateRoleCalls int
	offboardCalls   int
}

func (f *fakeEmployeeRepo) GetByID(_ context.Context, id string) (*domain.User, error) {
	if u, ok := f.users[id]; ok {
		return u, nil
	}
	return nil, domain.ErrUserNotFound
}
func (f *fakeEmployeeRepo) GetByLineUserID(context.Context, string) (*domain.User, error) {
	return nil, domain.ErrUserNotFound
}
func (f *fakeEmployeeRepo) GetByUsername(context.Context, string) (*domain.User, error) {
	return nil, domain.ErrUserNotFound
}
func (f *fakeEmployeeRepo) CreateEmployeeFromLine(context.Context, string, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeEmployeeRepo) UpdateLineProfile(context.Context, string, string, string) error {
	return nil
}
func (f *fakeEmployeeRepo) CompleteRegistration(context.Context, string, string, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeEmployeeRepo) CreateSystemOwner(context.Context, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeEmployeeRepo) ListActiveEmployees(context.Context) ([]*domain.User, error) {
	return nil, nil
}
func (f *fakeEmployeeRepo) List(_ context.Context, filter domain.EmployeeListFilter) ([]*domain.User, int, error) {
	f.listCalls++
	f.lastListFilter = filter
	out := make([]*domain.User, 0, len(f.users))
	for _, u := range f.users {
		out = append(out, u)
	}
	return out, len(out), nil
}
func (f *fakeEmployeeRepo) Update(_ context.Context, id string, firstName, lastName, teamID *string) (*domain.User, error) {
	f.updateCalls++
	u, ok := f.users[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	u.FirstName, u.LastName, u.TeamID = firstName, lastName, teamID
	return u, nil
}
func (f *fakeEmployeeRepo) UpdateRole(_ context.Context, id string, role domain.Role) (*domain.User, error) {
	f.updateRoleCalls++
	u, ok := f.users[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	u.Role = role
	return u, nil
}
func (f *fakeEmployeeRepo) Offboard(_ context.Context, id, offboardedBy string, reason *string) (*domain.User, error) {
	f.offboardCalls++
	u, ok := f.users[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	if u.OffboardedAt != nil {
		return nil, domain.ErrUserAlreadyOffboarded
	}
	now := u.CreatedAt // any non-nil time.Time stand-in
	u.OffboardedAt = &now
	u.OffboardedBy = &offboardedBy
	u.OffboardedReason = reason
	return u, nil
}

func newEmployeeUsecase(users map[string]*domain.User) (*usecase.EmployeeUsecase, *fakeEmployeeRepo, *fakeAuditLogRepo) {
	repo := &fakeEmployeeRepo{users: users}
	auditRepo := &fakeAuditLogRepo{}
	audit := usecase.NewAuditLogUsecase(auditRepo)
	return usecase.NewEmployeeUsecase(repo, audit), repo, auditRepo
}

func TestEmployeeUsecase_UpdateRole_RejectsPromotionToSystemOwner(t *testing.T) {
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, auditRepo := newEmployeeUsecase(map[string]*domain.User{"user-1": target})

	_, err := uc.UpdateRole(context.Background(), "admin-1", "user-1", domain.RoleSystemOwner)
	require.ErrorIs(t, err, domain.ErrCannotModifySystemOwnerRole)
	require.Equal(t, 0, repo.updateRoleCalls, "must not reach the repository")
	require.Equal(t, 0, auditRepo.calls, "a rejected change must not be logged")
}

func TestEmployeeUsecase_UpdateRole_RejectsDemotionFromSystemOwner(t *testing.T) {
	target := &domain.User{ID: "owner-1", Role: domain.RoleSystemOwner}
	uc, repo, auditRepo := newEmployeeUsecase(map[string]*domain.User{"owner-1": target})

	_, err := uc.UpdateRole(context.Background(), "admin-1", "owner-1", domain.RoleAdmin)
	require.ErrorIs(t, err, domain.ErrCannotModifySystemOwnerRole)
	require.Equal(t, 0, repo.updateRoleCalls, "must not reach the repository")
	require.Equal(t, 0, auditRepo.calls)
}

func TestEmployeeUsecase_UpdateRole_AllowsOrdinaryTransition(t *testing.T) {
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, auditRepo := newEmployeeUsecase(map[string]*domain.User{"user-1": target})

	updated, err := uc.UpdateRole(context.Background(), "admin-1", "user-1", domain.RoleSupervisor)
	require.NoError(t, err)
	require.Equal(t, domain.RoleSupervisor, updated.Role)
	require.Equal(t, 1, repo.updateRoleCalls)

	require.Equal(t, 1, auditRepo.calls)
	require.Equal(t, "admin-1", auditRepo.actorID)
	require.Equal(t, "employee.update_role", auditRepo.action)
}

func TestEmployeeUsecase_UpdateRole_PropagatesNotFound(t *testing.T) {
	uc, _, _ := newEmployeeUsecase(map[string]*domain.User{})

	_, err := uc.UpdateRole(context.Background(), "admin-1", "does-not-exist", domain.RoleSupervisor)
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

func TestEmployeeUsecase_Offboard_RejectsSystemOwner(t *testing.T) {
	target := &domain.User{ID: "owner-1", Role: domain.RoleSystemOwner}
	uc, repo, auditRepo := newEmployeeUsecase(map[string]*domain.User{"owner-1": target})

	_, err := uc.Offboard(context.Background(), "admin-1", "owner-1", nil)
	require.ErrorIs(t, err, domain.ErrCannotOffboardSystemOwner)
	require.Equal(t, 0, repo.offboardCalls, "must not reach the repository")
	require.Equal(t, 0, auditRepo.calls, "a rejected offboard must not be logged")
	require.Nil(t, target.OffboardedAt, "the system_owner row must be untouched")
}

func TestEmployeeUsecase_Offboard_AllowsOrdinaryEmployee(t *testing.T) {
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, auditRepo := newEmployeeUsecase(map[string]*domain.User{"user-1": target})

	reason := "resigned"
	offboarded, err := uc.Offboard(context.Background(), "admin-1", "user-1", &reason)
	require.NoError(t, err)
	require.NotNil(t, offboarded.OffboardedAt)
	require.Equal(t, 1, repo.offboardCalls)

	require.Equal(t, 1, auditRepo.calls)
	require.Equal(t, "admin-1", auditRepo.actorID)
	require.Equal(t, "employee.offboard", auditRepo.action)
}

func TestEmployeeUsecase_Offboard_PropagatesAlreadyOffboarded(t *testing.T) {
	now := (&domain.User{}).CreatedAt
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee, OffboardedAt: &now}
	uc, _, auditRepo := newEmployeeUsecase(map[string]*domain.User{"user-1": target})

	_, err := uc.Offboard(context.Background(), "admin-1", "user-1", nil)
	require.ErrorIs(t, err, domain.ErrUserAlreadyOffboarded)
	require.Equal(t, 0, auditRepo.calls, "a failed offboard must not be logged")
}

func TestEmployeeUsecase_Offboard_PropagatesNotFound(t *testing.T) {
	uc, _, _ := newEmployeeUsecase(map[string]*domain.User{})

	_, err := uc.Offboard(context.Background(), "admin-1", "does-not-exist", nil)
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

func TestEmployeeUsecase_List_AppliesDefaultLimit(t *testing.T) {
	uc, repo, _ := newEmployeeUsecase(map[string]*domain.User{})

	_, _, err := uc.List(context.Background(), domain.EmployeeListFilter{})
	require.NoError(t, err)
	require.Equal(t, usecase.DefaultEmployeeListLimit, repo.lastListFilter.Limit)
}

func TestEmployeeUsecase_List_ClampsExcessiveLimit(t *testing.T) {
	uc, repo, _ := newEmployeeUsecase(map[string]*domain.User{})

	_, _, err := uc.List(context.Background(), domain.EmployeeListFilter{Limit: 10_000})
	require.NoError(t, err)
	require.Equal(t, usecase.MaxEmployeeListLimit, repo.lastListFilter.Limit)
}

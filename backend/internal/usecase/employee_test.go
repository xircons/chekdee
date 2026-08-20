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

	// lastUpdateRoleAudit/lastOffboardAudit capture the audit entry passed
	// into these two methods — UpdateRole/Offboard now write their audit
	// row transactionally inside the repository call itself (see
	// UserRepository.UpdateRole/Offboard), not via a separate
	// AuditLogUsecase.Log call afterward like Update still does. So these
	// two are what a test asserts against instead of fakeAuditLogRepo.calls.
	lastUpdateRoleAudit *domain.AdminAuditLog
	lastOffboardAudit   *domain.AdminAuditLog
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
func (f *fakeEmployeeRepo) CompleteRegistration(context.Context, string, string, string, string, *string, *string) (*domain.User, error) {
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
func (f *fakeEmployeeRepo) Update(_ context.Context, id string, firstName, lastName, teamID, studentID, phoneNumber *string) (*domain.User, error) {
	f.updateCalls++
	u, ok := f.users[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	u.FirstName, u.LastName, u.TeamID = firstName, lastName, teamID
	u.StudentID, u.PhoneNumber = studentID, phoneNumber
	return u, nil
}
func (f *fakeEmployeeRepo) UpdateRole(_ context.Context, id string, role domain.Role, auditEntry *domain.AdminAuditLog) (*domain.User, error) {
	f.updateRoleCalls++
	f.lastUpdateRoleAudit = auditEntry
	u, ok := f.users[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	u.Role = role
	return u, nil
}
func (f *fakeEmployeeRepo) Offboard(_ context.Context, id string, reason *string, auditEntry *domain.AdminAuditLog) (*domain.User, error) {
	f.offboardCalls++
	f.lastOffboardAudit = auditEntry
	u, ok := f.users[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	if u.OffboardedAt != nil {
		return nil, domain.ErrUserAlreadyOffboarded
	}
	now := u.CreatedAt // any non-nil time.Time stand-in
	u.OffboardedAt = &now
	u.OffboardedBy = &auditEntry.ActorID
	u.OffboardedReason = reason
	return u, nil
}

func newEmployeeUsecase(users map[string]*domain.User) (*usecase.EmployeeUsecase, *fakeEmployeeRepo, *fakeAuditLogRepo) {
	repo := &fakeEmployeeRepo{users: users}
	auditRepo := &fakeAuditLogRepo{}
	audit := usecase.NewAuditLogUsecase(auditRepo)
	return usecase.NewEmployeeUsecase(repo, audit), repo, auditRepo
}

// usersFor is a small builder to keep the rank-matrix tests below readable:
// each test seeds exactly the actor/target pair it needs.
func usersFor(pairs ...*domain.User) map[string]*domain.User {
	out := make(map[string]*domain.User, len(pairs))
	for _, u := range pairs {
		out[u.ID] = u
	}
	return out
}

func TestEmployeeUsecase_UpdateRole_RejectsPromotionToSystemOwner(t *testing.T) {
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, auditRepo := newEmployeeUsecase(usersFor(target))

	_, err := uc.UpdateRole(context.Background(), "admin-1", "user-1", domain.RoleSystemOwner)
	require.ErrorIs(t, err, domain.ErrCannotModifySystemOwnerRole)
	require.Equal(t, 0, repo.updateRoleCalls, "must not reach the repository")
	require.Equal(t, 0, auditRepo.calls, "a rejected change must not be logged")
}

func TestEmployeeUsecase_UpdateRole_RejectsDemotionFromSystemOwner(t *testing.T) {
	target := &domain.User{ID: "owner-1", Role: domain.RoleSystemOwner}
	uc, repo, auditRepo := newEmployeeUsecase(usersFor(target))

	_, err := uc.UpdateRole(context.Background(), "admin-1", "owner-1", domain.RoleAdmin)
	require.ErrorIs(t, err, domain.ErrCannotModifySystemOwnerRole)
	require.Equal(t, 0, repo.updateRoleCalls, "must not reach the repository")
	require.Equal(t, 0, auditRepo.calls)
}

func TestEmployeeUsecase_UpdateRole_RejectsSelfChange(t *testing.T) {
	admin := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	uc, repo, auditRepo := newEmployeeUsecase(usersFor(admin))

	_, err := uc.UpdateRole(context.Background(), "admin-1", "admin-1", domain.RoleSupervisor)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.updateRoleCalls, "must not reach the repository, even for an admin acting on themselves")
	require.Equal(t, 0, auditRepo.calls)
}

func TestEmployeeUsecase_UpdateRole_SupervisorCannotGrantAdmin(t *testing.T) {
	supervisor := &domain.User{ID: "supervisor-1", Role: domain.RoleSupervisor}
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, auditRepo := newEmployeeUsecase(usersFor(supervisor, target))

	_, err := uc.UpdateRole(context.Background(), "supervisor-1", "user-1", domain.RoleAdmin)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.updateRoleCalls)
	require.Equal(t, 0, auditRepo.calls)
}

func TestEmployeeUsecase_UpdateRole_SupervisorCannotGrantSupervisor(t *testing.T) {
	// A supervisor granting *supervisor* (not just admin) must also be
	// blocked — supervisor can never grant a role at or above its own rank.
	supervisor := &domain.User{ID: "supervisor-1", Role: domain.RoleSupervisor}
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, _ := newEmployeeUsecase(usersFor(supervisor, target))

	_, err := uc.UpdateRole(context.Background(), "supervisor-1", "user-1", domain.RoleSupervisor)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.updateRoleCalls)
}

func TestEmployeeUsecase_UpdateRole_SupervisorCannotActOnAdminPeer(t *testing.T) {
	// Even a role-change that would itself be a demotion (admin -> employee)
	// must be blocked when the actor doesn't outrank the target's *current*
	// role — a supervisor never outranks an admin.
	supervisor := &domain.User{ID: "supervisor-1", Role: domain.RoleSupervisor}
	admin := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	uc, repo, _ := newEmployeeUsecase(usersFor(supervisor, admin))

	_, err := uc.UpdateRole(context.Background(), "supervisor-1", "admin-1", domain.RoleEmployee)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.updateRoleCalls)
}

func TestEmployeeUsecase_UpdateRole_AdminCannotActOnAdminPeer(t *testing.T) {
	// Rank must be strictly greater — two admins are equal rank, so neither
	// can change the other's role.
	actor := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	target := &domain.User{ID: "admin-2", Role: domain.RoleAdmin}
	uc, repo, _ := newEmployeeUsecase(usersFor(actor, target))

	_, err := uc.UpdateRole(context.Background(), "admin-1", "admin-2", domain.RoleSupervisor)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.updateRoleCalls)
}

func TestEmployeeUsecase_UpdateRole_AdminGrantsSupervisor(t *testing.T) {
	admin := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, _ := newEmployeeUsecase(usersFor(admin, target))

	updated, err := uc.UpdateRole(context.Background(), "admin-1", "user-1", domain.RoleSupervisor)
	require.NoError(t, err)
	require.Equal(t, domain.RoleSupervisor, updated.Role)
	require.Equal(t, 1, repo.updateRoleCalls)

	// Audit entry is written transactionally inside UserRepository.UpdateRole
	// itself (see fakeEmployeeRepo.UpdateRole), not via a separate
	// AuditLogUsecase.Log call — assert the entry the usecase built.
	require.NotNil(t, repo.lastUpdateRoleAudit)
	require.Equal(t, "admin-1", repo.lastUpdateRoleAudit.ActorID)
	require.Equal(t, "employee.update_role", repo.lastUpdateRoleAudit.Action)
}

func TestEmployeeUsecase_UpdateRole_SystemOwnerGrantsAdmin(t *testing.T) {
	owner := &domain.User{ID: "owner-1", Role: domain.RoleSystemOwner}
	target := &domain.User{ID: "user-1", Role: domain.RoleSupervisor}
	uc, repo, _ := newEmployeeUsecase(usersFor(owner, target))

	updated, err := uc.UpdateRole(context.Background(), "owner-1", "user-1", domain.RoleAdmin)
	require.NoError(t, err)
	require.Equal(t, domain.RoleAdmin, updated.Role)
	require.Equal(t, 1, repo.updateRoleCalls)
}

func TestEmployeeUsecase_UpdateRole_PropagatesNotFound(t *testing.T) {
	uc, _, _ := newEmployeeUsecase(usersFor())

	_, err := uc.UpdateRole(context.Background(), "admin-1", "does-not-exist", domain.RoleSupervisor)
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

func TestEmployeeUsecase_Offboard_RejectsSystemOwner(t *testing.T) {
	target := &domain.User{ID: "owner-1", Role: domain.RoleSystemOwner}
	uc, repo, auditRepo := newEmployeeUsecase(usersFor(target))

	_, err := uc.Offboard(context.Background(), "admin-1", "owner-1", nil)
	require.ErrorIs(t, err, domain.ErrCannotOffboardSystemOwner)
	require.Equal(t, 0, repo.offboardCalls, "must not reach the repository")
	require.Equal(t, 0, auditRepo.calls, "a rejected offboard must not be logged")
	require.Nil(t, target.OffboardedAt, "the system_owner row must be untouched")
}

func TestEmployeeUsecase_Offboard_RejectsSelfOffboard(t *testing.T) {
	admin := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	uc, repo, auditRepo := newEmployeeUsecase(usersFor(admin))

	_, err := uc.Offboard(context.Background(), "admin-1", "admin-1", nil)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.offboardCalls, "must not reach the repository, even for an admin acting on themselves")
	require.Equal(t, 0, auditRepo.calls)
}

func TestEmployeeUsecase_Offboard_SupervisorCannotOffboardAdmin(t *testing.T) {
	supervisor := &domain.User{ID: "supervisor-1", Role: domain.RoleSupervisor}
	admin := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	uc, repo, auditRepo := newEmployeeUsecase(usersFor(supervisor, admin))

	_, err := uc.Offboard(context.Background(), "supervisor-1", "admin-1", nil)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.offboardCalls)
	require.Equal(t, 0, auditRepo.calls)
	require.Nil(t, admin.OffboardedAt, "the admin row must be untouched")
}

func TestEmployeeUsecase_Offboard_SupervisorCannotOffboardPeer(t *testing.T) {
	actor := &domain.User{ID: "supervisor-1", Role: domain.RoleSupervisor}
	target := &domain.User{ID: "supervisor-2", Role: domain.RoleSupervisor}
	uc, repo, _ := newEmployeeUsecase(usersFor(actor, target))

	_, err := uc.Offboard(context.Background(), "supervisor-1", "supervisor-2", nil)
	require.ErrorIs(t, err, domain.ErrInsufficientRole)
	require.Equal(t, 0, repo.offboardCalls)
}

func TestEmployeeUsecase_Offboard_SupervisorCanOffboardEmployee(t *testing.T) {
	supervisor := &domain.User{ID: "supervisor-1", Role: domain.RoleSupervisor}
	employee := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, _ := newEmployeeUsecase(usersFor(supervisor, employee))

	offboarded, err := uc.Offboard(context.Background(), "supervisor-1", "user-1", nil)
	require.NoError(t, err)
	require.NotNil(t, offboarded.OffboardedAt)
	require.Equal(t, 1, repo.offboardCalls)
	require.NotNil(t, repo.lastOffboardAudit)
}

func TestEmployeeUsecase_Offboard_AllowsOrdinaryEmployee(t *testing.T) {
	admin := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee}
	uc, repo, _ := newEmployeeUsecase(usersFor(admin, target))

	reason := "resigned"
	offboarded, err := uc.Offboard(context.Background(), "admin-1", "user-1", &reason)
	require.NoError(t, err)
	require.NotNil(t, offboarded.OffboardedAt)
	require.Equal(t, 1, repo.offboardCalls)

	// Audit entry is written transactionally inside UserRepository.Offboard
	// itself (see fakeEmployeeRepo.Offboard) — assert the entry the usecase
	// built, not a separate AuditLogUsecase.Log call.
	require.NotNil(t, repo.lastOffboardAudit)
	require.Equal(t, "admin-1", repo.lastOffboardAudit.ActorID)
	require.Equal(t, "employee.offboard", repo.lastOffboardAudit.Action)
}

func TestEmployeeUsecase_Offboard_PropagatesAlreadyOffboarded(t *testing.T) {
	admin := &domain.User{ID: "admin-1", Role: domain.RoleAdmin}
	now := admin.CreatedAt
	target := &domain.User{ID: "user-1", Role: domain.RoleEmployee, OffboardedAt: &now}
	uc, _, auditRepo := newEmployeeUsecase(usersFor(admin, target))

	_, err := uc.Offboard(context.Background(), "admin-1", "user-1", nil)
	require.ErrorIs(t, err, domain.ErrUserAlreadyOffboarded)
	require.Equal(t, 0, auditRepo.calls, "a failed offboard must not be logged")
}

func TestEmployeeUsecase_Offboard_PropagatesNotFound(t *testing.T) {
	uc, _, _ := newEmployeeUsecase(usersFor())

	_, err := uc.Offboard(context.Background(), "admin-1", "does-not-exist", nil)
	require.ErrorIs(t, err, domain.ErrUserNotFound)
}

func TestEmployeeUsecase_List_AppliesDefaultLimit(t *testing.T) {
	uc, repo, _ := newEmployeeUsecase(usersFor())

	_, _, err := uc.List(context.Background(), domain.EmployeeListFilter{})
	require.NoError(t, err)
	require.Equal(t, usecase.DefaultEmployeeListLimit, repo.lastListFilter.Limit)
}

func TestEmployeeUsecase_List_ClampsExcessiveLimit(t *testing.T) {
	uc, repo, _ := newEmployeeUsecase(usersFor())

	_, _, err := uc.List(context.Background(), domain.EmployeeListFilter{Limit: 10_000})
	require.NoError(t, err)
	require.Equal(t, usecase.MaxEmployeeListLimit, repo.lastListFilter.Limit)
}

func TestEmployeeUsecase_List_ClampsNegativeOffset(t *testing.T) {
	uc, repo, _ := newEmployeeUsecase(usersFor())

	_, _, err := uc.List(context.Background(), domain.EmployeeListFilter{Offset: -5})
	require.NoError(t, err)
	require.Equal(t, 0, repo.lastListFilter.Offset)
}

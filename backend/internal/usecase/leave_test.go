package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type fakeLeaveRepo struct {
	created      *domain.LeaveRequest
	decideCalls  int
	decideStatus domain.LeaveStatus
	decideErr    error
}

func (f *fakeLeaveRepo) Create(_ context.Context, employeeID string, leaveType, reason *string, startDate, endDate time.Time) (*domain.LeaveRequest, error) {
	f.created = &domain.LeaveRequest{ID: "leave-1", EmployeeID: employeeID, LeaveType: leaveType, Reason: reason, StartDate: startDate, EndDate: endDate, Status: domain.LeaveStatusPending}
	return f.created, nil
}
func (f *fakeLeaveRepo) Get(context.Context, string) (*domain.LeaveRequest, error) { return nil, nil }
func (f *fakeLeaveRepo) ListForEmployee(context.Context, string) ([]*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepo) ListAll(context.Context) ([]*domain.LeaveRequest, error) { return nil, nil }
func (f *fakeLeaveRepo) Decide(_ context.Context, id string, status domain.LeaveStatus, decidedBy, decidedFromIP string) (*domain.LeaveRequest, error) {
	f.decideCalls++
	f.decideStatus = status
	if f.decideErr != nil {
		return nil, f.decideErr
	}
	return &domain.LeaveRequest{ID: id, EmployeeID: "employee-1", Status: status, DecidedBy: &decidedBy}, nil
}

type fakeAuditLogRepo struct {
	calls   int
	actorID string
	action  string
}

func (f *fakeAuditLogRepo) Create(_ context.Context, l *domain.AdminAuditLog) (*domain.AdminAuditLog, error) {
	f.calls++
	f.actorID = l.ActorID
	f.action = l.Action
	return l, nil
}
func (f *fakeAuditLogRepo) ListForTarget(context.Context, string, string) ([]*domain.AdminAuditLog, error) {
	return nil, nil
}

func TestLeaveUsecase_Create_RejectsBadDateOrder(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, audit)

	start := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 5, 0, 0, 0, 0, time.UTC) // before start

	_, err := uc.Create(context.Background(), "employee-1", nil, nil, start, end)
	require.ErrorIs(t, err, usecase.ErrLeaveDateOrder)
	require.Nil(t, leaves.created, "must not reach the repository with bad dates")
}

func TestLeaveUsecase_Create_Success(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, audit)

	start := time.Date(2026, 6, 5, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)

	created, err := uc.Create(context.Background(), "employee-1", nil, nil, start, end)
	require.NoError(t, err)
	require.Equal(t, "employee-1", created.EmployeeID)
}

func TestLeaveUsecase_Decide_LogsAuditEntry(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	auditRepo := &fakeAuditLogRepo{}
	audit := usecase.NewAuditLogUsecase(auditRepo)
	uc := usecase.NewLeaveUsecase(leaves, audit)

	decided, err := uc.Decide(context.Background(), "leave-1", domain.LeaveStatusApproved, "admin-1", "127.0.0.1")
	require.NoError(t, err)
	require.Equal(t, domain.LeaveStatusApproved, decided.Status)
	require.Equal(t, 1, leaves.decideCalls)

	require.Equal(t, 1, auditRepo.calls, "a decision must write an audit log entry — PR 4's AuditLogUsecase's first real consumer")
	require.Equal(t, "admin-1", auditRepo.actorID)
	require.Equal(t, "leave.decide", auditRepo.action)
}

func TestLeaveUsecase_Decide_PropagatesRepoError(t *testing.T) {
	leaves := &fakeLeaveRepo{decideErr: domain.ErrLeaveRequestAlreadyDecided}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, audit)

	_, err := uc.Decide(context.Background(), "leave-1", domain.LeaveStatusRejected, "admin-1", "127.0.0.1")
	require.ErrorIs(t, err, domain.ErrLeaveRequestAlreadyDecided)
}

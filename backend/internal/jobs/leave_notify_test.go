package jobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/jobs"
)

type fakeLeaveRepoForNotify struct {
	leave *domain.LeaveRequest
	err   error
}

func (f *fakeLeaveRepoForNotify) Create(context.Context, string, *string, *string, time.Time, time.Time) (*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepoForNotify) Get(context.Context, string) (*domain.LeaveRequest, error) {
	return f.leave, f.err
}
func (f *fakeLeaveRepoForNotify) ListForEmployee(context.Context, string) ([]*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepoForNotify) ListAll(context.Context) ([]*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepoForNotify) Decide(context.Context, string, domain.LeaveStatus, string, string) (*domain.LeaveRequest, error) {
	return nil, nil
}

type fakeNotificationRepoForLeaveNotify struct {
	recipientID string
	notifType   string
	calls       int
}

func (f *fakeNotificationRepoForLeaveNotify) Create(_ context.Context, recipientID, notifType, _ string, _ *string, _ any) error {
	f.calls++
	f.recipientID = recipientID
	f.notifType = notifType
	return nil
}
func (f *fakeNotificationRepoForLeaveNotify) ListForRecipient(context.Context, string, bool) ([]*domain.Notification, error) {
	return nil, nil
}
func (f *fakeNotificationRepoForLeaveNotify) MarkRead(context.Context, string, string) error {
	return nil
}

func TestLeaveDecisionNotifyWorker_Work_Approved(t *testing.T) {
	leaves := &fakeLeaveRepoForNotify{leave: &domain.LeaveRequest{
		ID: "leave-1", EmployeeID: "employee-1", Status: domain.LeaveStatusApproved,
		StartDate: time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2026, 6, 2, 0, 0, 0, 0, time.UTC),
	}}
	notifications := &fakeNotificationRepoForLeaveNotify{}
	worker := jobs.NewLeaveDecisionNotifyWorker(leaves, notifications)

	err := worker.Work(context.Background(), &river.Job[jobs.LeaveDecisionNotifyArgs]{
		Args: jobs.LeaveDecisionNotifyArgs{LeaveRequestID: "leave-1"},
	})
	require.NoError(t, err)
	require.Equal(t, 1, notifications.calls)
	require.Equal(t, "employee-1", notifications.recipientID)
	require.Equal(t, "leave.decided", notifications.notifType)
}

func TestLeaveDecisionNotifyWorker_Work_Rejected(t *testing.T) {
	leaves := &fakeLeaveRepoForNotify{leave: &domain.LeaveRequest{
		ID: "leave-2", EmployeeID: "employee-2", Status: domain.LeaveStatusRejected,
	}}
	notifications := &fakeNotificationRepoForLeaveNotify{}
	worker := jobs.NewLeaveDecisionNotifyWorker(leaves, notifications)

	err := worker.Work(context.Background(), &river.Job[jobs.LeaveDecisionNotifyArgs]{
		Args: jobs.LeaveDecisionNotifyArgs{LeaveRequestID: "leave-2"},
	})
	require.NoError(t, err)
	require.Equal(t, 1, notifications.calls)
}

func TestLeaveDecisionNotifyWorker_Work_StillPending_NoNotification(t *testing.T) {
	leaves := &fakeLeaveRepoForNotify{leave: &domain.LeaveRequest{
		ID: "leave-3", EmployeeID: "employee-3", Status: domain.LeaveStatusPending,
	}}
	notifications := &fakeNotificationRepoForLeaveNotify{}
	worker := jobs.NewLeaveDecisionNotifyWorker(leaves, notifications)

	err := worker.Work(context.Background(), &river.Job[jobs.LeaveDecisionNotifyArgs]{
		Args: jobs.LeaveDecisionNotifyArgs{LeaveRequestID: "leave-3"},
	})
	require.NoError(t, err)
	require.Zero(t, notifications.calls)
}

func TestLeaveDecisionNotifyWorker_Work_LoadErrorPropagates(t *testing.T) {
	leaves := &fakeLeaveRepoForNotify{err: errors.New("not found")}
	notifications := &fakeNotificationRepoForLeaveNotify{}
	worker := jobs.NewLeaveDecisionNotifyWorker(leaves, notifications)

	err := worker.Work(context.Background(), &river.Job[jobs.LeaveDecisionNotifyArgs]{
		Args: jobs.LeaveDecisionNotifyArgs{LeaveRequestID: "leave-4"},
	})
	require.Error(t, err)
	require.Zero(t, notifications.calls)
}

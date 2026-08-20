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

type fakeAttendanceRepoForAutoClose struct {
	closed []*domain.AttendanceRecord
	err    error
}

func (f *fakeAttendanceRepoForAutoClose) GetForEmployeeDate(context.Context, string, time.Time) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForAutoClose) GetByIdempotencyKey(context.Context, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForAutoClose) CheckIn(context.Context, string, time.Time, time.Time, domain.AttendanceStatus, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForAutoClose) CheckOut(context.Context, string, time.Time, time.Time, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForAutoClose) ListForMonth(context.Context, time.Time, time.Time) ([]*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForAutoClose) GetByID(context.Context, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForAutoClose) CorrectStatus(context.Context, string, string, domain.AttendanceStatus, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForAutoClose) AutoCloseOpenRecords(context.Context, time.Time) ([]*domain.AttendanceRecord, error) {
	return f.closed, f.err
}

type fakeNotificationRepoForAutoClose struct {
	created []string // recipient IDs, in call order
}

func (f *fakeNotificationRepoForAutoClose) Create(_ context.Context, recipientID, _, _ string, _ *string, _ any) error {
	f.created = append(f.created, recipientID)
	return nil
}
func (f *fakeNotificationRepoForAutoClose) ListForRecipient(context.Context, string, bool) ([]*domain.Notification, error) {
	return nil, nil
}
func (f *fakeNotificationRepoForAutoClose) MarkRead(context.Context, string, string) error {
	return nil
}

func TestAttendanceAutoCloseWorker_Work_NotifiesEachClosedEmployee(t *testing.T) {
	workDate := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	attendance := &fakeAttendanceRepoForAutoClose{closed: []*domain.AttendanceRecord{
		{ID: "rec-1", EmployeeID: "employee-1", WorkDate: workDate},
		{ID: "rec-2", EmployeeID: "employee-2", WorkDate: workDate},
	}}
	notifications := &fakeNotificationRepoForAutoClose{}
	worker := jobs.NewAttendanceAutoCloseWorker(attendance, notifications)

	err := worker.Work(context.Background(), &river.Job[jobs.AttendanceAutoCloseArgs]{})
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"employee-1", "employee-2"}, notifications.created)
}

func TestAttendanceAutoCloseWorker_Work_NoClosedRecords(t *testing.T) {
	attendance := &fakeAttendanceRepoForAutoClose{}
	notifications := &fakeNotificationRepoForAutoClose{}
	worker := jobs.NewAttendanceAutoCloseWorker(attendance, notifications)

	err := worker.Work(context.Background(), &river.Job[jobs.AttendanceAutoCloseArgs]{})
	require.NoError(t, err)
	require.Empty(t, notifications.created)
}

func TestAttendanceAutoCloseWorker_Work_AutoCloseErrorPropagates(t *testing.T) {
	attendance := &fakeAttendanceRepoForAutoClose{err: errors.New("db down")}
	notifications := &fakeNotificationRepoForAutoClose{}
	worker := jobs.NewAttendanceAutoCloseWorker(attendance, notifications)

	err := worker.Work(context.Background(), &river.Job[jobs.AttendanceAutoCloseArgs]{})
	require.Error(t, err)
	require.Empty(t, notifications.created)
}

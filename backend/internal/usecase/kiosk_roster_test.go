package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type fakeUserRepoForKioskRoster struct {
	employees []*domain.User
}

func (f *fakeUserRepoForKioskRoster) GetByID(context.Context, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) GetByLineUserID(context.Context, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) GetByUsername(context.Context, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) CreateEmployeeFromLine(context.Context, string, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) UpdateLineProfile(context.Context, string, string, string) error {
	return nil
}
func (f *fakeUserRepoForKioskRoster) CompleteRegistration(context.Context, string, string, string, string, *string, *string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) CreateSystemOwner(context.Context, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) ListActiveEmployees(context.Context) ([]*domain.User, error) {
	return f.employees, nil
}
func (f *fakeUserRepoForKioskRoster) List(context.Context, domain.EmployeeListFilter) ([]*domain.User, int, error) {
	return nil, 0, nil
}
func (f *fakeUserRepoForKioskRoster) Update(context.Context, string, *string, *string, *string, *string, *string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) UpdateRole(context.Context, string, domain.Role, *domain.AdminAuditLog) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForKioskRoster) Offboard(context.Context, string, *string, *domain.AdminAuditLog) (*domain.User, error) {
	return nil, nil
}

type fakeAttendanceRepoForKioskRoster struct {
	records []*domain.AttendanceRecord
}

func (f *fakeAttendanceRepoForKioskRoster) GetForEmployeeDate(context.Context, string, time.Time) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForKioskRoster) GetByIdempotencyKey(context.Context, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForKioskRoster) CheckIn(context.Context, string, time.Time, time.Time, domain.AttendanceStatus, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForKioskRoster) CheckOut(context.Context, string, time.Time, time.Time, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForKioskRoster) AutoCloseOpenRecords(context.Context, time.Time) ([]*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForKioskRoster) ListForMonth(context.Context, time.Time, time.Time) ([]*domain.AttendanceRecord, error) {
	return f.records, nil
}
func (f *fakeAttendanceRepoForKioskRoster) CorrectStatus(context.Context, string, string, domain.AttendanceStatus, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForKioskRoster) GetByID(context.Context, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}

type fakeLeaveRepoForKioskRoster struct {
	requests []*domain.LeaveRequest
}

func (f *fakeLeaveRepoForKioskRoster) Create(context.Context, string, *string, *string, time.Time, time.Time) (*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepoForKioskRoster) Get(context.Context, string) (*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepoForKioskRoster) ListForEmployee(context.Context, string) ([]*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepoForKioskRoster) ListAll(context.Context) ([]*domain.LeaveRequest, error) {
	return f.requests, nil
}
func (f *fakeLeaveRepoForKioskRoster) Decide(context.Context, string, domain.LeaveStatus, string, string) (*domain.LeaveRequest, error) {
	return nil, nil
}

func TestKioskRosterUsecase_Stats(t *testing.T) {
	reset := usecase.SetClockForTest(func() time.Time {
		return time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	})
	t.Cleanup(reset)

	today := time.Date(2026, 8, 21, 0, 0, 0, 0, time.UTC)
	yesterday := today.AddDate(0, 0, -1)

	users := &fakeUserRepoForKioskRoster{employees: []*domain.User{
		{ID: "e1"}, {ID: "e2"}, {ID: "e3"}, {ID: "e4"}, {ID: "e5"},
	}}
	attendance := &fakeAttendanceRepoForKioskRoster{records: []*domain.AttendanceRecord{
		{EmployeeID: "e1", WorkDate: today, Status: domain.AttendanceStatusPresent},
		{EmployeeID: "e2", WorkDate: today, Status: domain.AttendanceStatusLate},
		{EmployeeID: "e3", WorkDate: today, Status: domain.AttendanceStatusAbsent},
		// Different day -- must not be counted (ListForMonth is faked to
		// return everything handed to it, unlike the real repo's date
		// filter, so this record only proves Stats doesn't miscount if the
		// repo ever returned extra rows).
		{EmployeeID: "e4", WorkDate: yesterday, Status: domain.AttendanceStatusPresent},
	}}
	approvedStart := today.AddDate(0, 0, -1)
	approvedEnd := today.AddDate(0, 0, 1)
	leaves := &fakeLeaveRepoForKioskRoster{requests: []*domain.LeaveRequest{
		{EmployeeID: "e5", Status: domain.LeaveStatusApproved, StartDate: approvedStart, EndDate: approvedEnd},
		// Pending -- must not count as on-leave.
		{EmployeeID: "e4", Status: domain.LeaveStatusPending, StartDate: today, EndDate: today},
	}}

	uc := usecase.NewKioskRosterUsecase(users, attendance, leaves)
	stats, err := uc.Stats(context.Background())
	require.NoError(t, err)

	require.Equal(t, 5, stats.TotalActive)
	require.Equal(t, 4, stats.CheckedIn, "all four attendance rows handed back by the (faked) repo call")
	require.Equal(t, 1, stats.Late)
	require.Equal(t, 1, stats.Absent)
	require.Equal(t, 1, stats.OnLeave)
}

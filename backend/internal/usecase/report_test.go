package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type fakeUserRepoForReport struct {
	employees []*domain.User
}

func (f *fakeUserRepoForReport) GetByID(context.Context, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) GetByLineUserID(context.Context, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) GetByUsername(context.Context, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) CreateEmployeeFromLine(context.Context, string, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) UpdateLineProfile(context.Context, string, string, string) error {
	return nil
}
func (f *fakeUserRepoForReport) CompleteRegistration(context.Context, string, string, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) CreateSystemOwner(context.Context, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) ListActiveEmployees(context.Context) ([]*domain.User, error) {
	return f.employees, nil
}
func (f *fakeUserRepoForReport) List(context.Context, domain.EmployeeListFilter) ([]*domain.User, int, error) {
	return nil, 0, nil
}
func (f *fakeUserRepoForReport) Update(context.Context, string, *string, *string, *string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) UpdateRole(context.Context, string, domain.Role) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepoForReport) Offboard(context.Context, string, string, *string) (*domain.User, error) {
	return nil, nil
}

type fakeAttendanceRepoForReport struct {
	records []*domain.AttendanceRecord
}

func (f *fakeAttendanceRepoForReport) GetForEmployeeDate(context.Context, string, time.Time) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForReport) GetByIdempotencyKey(context.Context, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForReport) CheckIn(context.Context, string, time.Time, time.Time, domain.AttendanceStatus, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForReport) CheckOut(context.Context, string, time.Time, time.Time, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForReport) AutoCloseOpenRecords(context.Context, time.Time) ([]*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepoForReport) ListForMonth(context.Context, time.Time, time.Time) ([]*domain.AttendanceRecord, error) {
	return f.records, nil
}

type fakeScheduleRepoForReport struct {
	schedules map[string][]*domain.WorkSchedule
}

func (f *fakeScheduleRepoForReport) ListForEmployee(_ context.Context, employeeID string) ([]*domain.WorkSchedule, error) {
	return f.schedules[employeeID], nil
}
func (f *fakeScheduleRepoForReport) ReplaceForEmployee(context.Context, string, []*domain.WorkSchedule) ([]*domain.WorkSchedule, error) {
	return nil, nil
}

type fakeReportRepo struct {
	leaveDays map[string]int
}

func (f *fakeReportRepo) ApprovedLeaveDaysByEmployee(context.Context, time.Time, time.Time) (map[string]int, error) {
	return f.leaveDays, nil
}

func bkkTime(y int, m time.Month, d, h, min int) time.Time {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		loc = time.FixedZone("Asia/Bangkok", 7*3600)
	}
	return time.Date(y, m, d, h, min, 0, 0, loc)
}

func TestReportUsecase_MonthlyReport_WorkedHoursCappedToSchedule(t *testing.T) {
	first, last := "Somchai", "Testcase"
	users := &fakeUserRepoForReport{employees: []*domain.User{{ID: "e1", FirstName: &first, LastName: &last}}}

	// Monday March 2, 2026 — checked in on time, but worked 10 actual hours
	// against an 8-hour scheduled shift (09:00-17:00). Capped result must be
	// 8.0, not 10.0 — the no-overtime rule.
	workDate := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	checkIn := bkkTime(2026, 3, 2, 9, 0)
	checkOut := bkkTime(2026, 3, 2, 19, 0) // 10 actual hours

	attendance := &fakeAttendanceRepoForReport{records: []*domain.AttendanceRecord{
		{EmployeeID: "e1", WorkDate: workDate, CheckInAt: &checkIn, CheckOutAt: &checkOut, Status: domain.AttendanceStatusPresent},
	}}
	schedules := &fakeScheduleRepoForReport{schedules: map[string][]*domain.WorkSchedule{
		"e1": {{
			DayOfWeek:     1, // Monday
			StartTime:     time.Date(0, 1, 1, 9, 0, 0, 0, time.UTC),
			EndTime:       time.Date(0, 1, 1, 17, 0, 0, 0, time.UTC),
			EffectiveFrom: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		}},
	}}
	reports := &fakeReportRepo{leaveDays: map[string]int{}}

	uc := usecase.NewReportUsecase(users, attendance, schedules, reports)
	rows, err := uc.MonthlyReport(context.Background(), "2026-03")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, 8.0, rows[0].WorkedHours, "worked hours must be capped to the scheduled 8-hour shift, not the actual 10")
	require.Equal(t, 1, rows[0].WorkDays)
}

func TestReportUsecase_MonthlyReport_LateMinutesOnlyCountedWhenLate(t *testing.T) {
	first, last := "Somchai", "Testcase"
	users := &fakeUserRepoForReport{employees: []*domain.User{{ID: "e1", FirstName: &first, LastName: &last}}}

	workDate := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	checkIn := bkkTime(2026, 3, 2, 9, 30) // 30 min late

	attendance := &fakeAttendanceRepoForReport{records: []*domain.AttendanceRecord{
		{EmployeeID: "e1", WorkDate: workDate, CheckInAt: &checkIn, Status: domain.AttendanceStatusLate},
	}}
	schedules := &fakeScheduleRepoForReport{schedules: map[string][]*domain.WorkSchedule{
		"e1": {{
			DayOfWeek:     1,
			StartTime:     time.Date(0, 1, 1, 9, 0, 0, 0, time.UTC),
			EndTime:       time.Date(0, 1, 1, 17, 0, 0, 0, time.UTC),
			EffectiveFrom: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		}},
	}}
	reports := &fakeReportRepo{leaveDays: map[string]int{}}

	uc := usecase.NewReportUsecase(users, attendance, schedules, reports)
	rows, err := uc.MonthlyReport(context.Background(), "2026-03")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, 1, rows[0].LateCount)
	require.Equal(t, 30, rows[0].LateMinutes)
}

func TestReportUsecase_MonthlyReport_IncludesLeaveDays(t *testing.T) {
	first, last := "Somchai", "Testcase"
	users := &fakeUserRepoForReport{employees: []*domain.User{{ID: "e1", FirstName: &first, LastName: &last}}}
	attendance := &fakeAttendanceRepoForReport{}
	schedules := &fakeScheduleRepoForReport{}
	reports := &fakeReportRepo{leaveDays: map[string]int{"e1": 3}}

	uc := usecase.NewReportUsecase(users, attendance, schedules, reports)
	rows, err := uc.MonthlyReport(context.Background(), "2026-03")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, 3, rows[0].LeaveDays)
}

func TestReportUsecase_DailyLog_FiltersByEmployee(t *testing.T) {
	first, last := "Somchai", "Testcase"
	users := &fakeUserRepoForReport{employees: []*domain.User{{ID: "e1", FirstName: &first, LastName: &last}}}
	workDate := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	attendance := &fakeAttendanceRepoForReport{records: []*domain.AttendanceRecord{
		{EmployeeID: "e1", WorkDate: workDate, Status: domain.AttendanceStatusPresent},
		{EmployeeID: "e2", WorkDate: workDate, Status: domain.AttendanceStatusAbsent},
	}}
	uc := usecase.NewReportUsecase(users, attendance, &fakeScheduleRepoForReport{}, &fakeReportRepo{})

	employeeID := "e1"
	rows, err := uc.DailyLog(context.Background(), "2026-03", &employeeID)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "e1", rows[0].EmployeeID)

	all, err := uc.DailyLog(context.Background(), "2026-03", nil)
	require.NoError(t, err)
	require.Len(t, all, 2)
}

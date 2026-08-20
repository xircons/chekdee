package usecase

import (
	"context"
	"time"

	"checkdee-backend/internal/domain"
)

type ReportUsecase struct {
	users      domain.UserRepository
	attendance domain.AttendanceRepository
	schedules  domain.WorkScheduleRepository
	reports    domain.ReportRepository
}

func NewReportUsecase(
	users domain.UserRepository,
	attendance domain.AttendanceRepository,
	schedules domain.WorkScheduleRepository,
	reports domain.ReportRepository,
) *ReportUsecase {
	return &ReportUsecase{users: users, attendance: attendance, schedules: schedules, reports: reports}
}

// monthRange parses "YYYY-MM" into [from, to) in UTC — matching how
// AttendanceRecord.WorkDate is stored (bangkokWorkDate always normalizes to
// a UTC midnight date value, see usecase/attendance.go).
func monthRange(month string) (from, to time.Time, err error) {
	from, err = time.Parse("2006-01", month)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	to = from.AddDate(0, 1, 0)
	return from, to, nil
}

// MonthlyReport computes one row per active employee, matching the
// frontend's already-shipped getMonthlyReportRow exactly: workedHours caps
// each day's actual hours to that day's scheduled shift length (never counts
// time outside the scheduled window), lateMinutes only counts late-status
// days with a matching schedule.
func (r *ReportUsecase) MonthlyReport(ctx context.Context, month string) ([]domain.MonthlyReportRow, error) {
	from, to, err := monthRange(month)
	if err != nil {
		return nil, err
	}

	employees, err := r.users.ListActiveEmployees(ctx)
	if err != nil {
		return nil, err
	}

	records, err := r.attendance.ListForMonth(ctx, from, to)
	if err != nil {
		return nil, err
	}
	recordsByEmployee := map[string][]*domain.AttendanceRecord{}
	for _, rec := range records {
		recordsByEmployee[rec.EmployeeID] = append(recordsByEmployee[rec.EmployeeID], rec)
	}

	leaveDays, err := r.reports.ApprovedLeaveDaysByEmployee(ctx, from, to)
	if err != nil {
		return nil, err
	}

	rows := make([]domain.MonthlyReportRow, 0, len(employees))
	for _, emp := range employees {
		schedules, err := r.schedules.ListForEmployee(ctx, emp.ID)
		if err != nil {
			return nil, err
		}

		row := domain.MonthlyReportRow{
			EmployeeID: emp.ID,
			FirstName:  emp.FirstName,
			LastName:   emp.LastName,
			LeaveDays:  leaveDays[emp.ID],
		}

		for _, rec := range recordsByEmployee[emp.ID] {
			switch rec.Status {
			case domain.AttendanceStatusPresent, domain.AttendanceStatusLate:
				row.WorkDays++
			}
			if rec.Status == domain.AttendanceStatusLate {
				row.LateCount++
			}
			if rec.Status == domain.AttendanceStatusAbsent {
				row.AbsentCount++
			}

			schedule := scheduleForDate(schedules, rec.WorkDate)

			if rec.Status == domain.AttendanceStatusLate && rec.CheckInAt != nil && schedule != nil {
				scheduledStart := scheduledTimeOn(rec.WorkDate, schedule.StartTime)
				lateMinutes := rec.CheckInAt.Sub(scheduledStart).Minutes()
				if lateMinutes > 0 {
					row.LateMinutes += int(lateMinutes + 0.5) // round to nearest minute
				}
			}

			if rec.CheckInAt != nil && rec.CheckOutAt != nil {
				actualHours := rec.CheckOutAt.Sub(*rec.CheckInAt).Hours()
				if schedule != nil {
					scheduledStart := scheduledTimeOn(rec.WorkDate, schedule.StartTime)
					scheduledEnd := scheduledTimeOn(rec.WorkDate, schedule.EndTime)
					shiftHours := scheduledEnd.Sub(scheduledStart).Hours()
					if actualHours > shiftHours {
						actualHours = shiftHours
					}
				}
				row.WorkedHours += actualHours
			}
		}
		row.WorkedHours = roundToOneDecimal(row.WorkedHours)

		rows = append(rows, row)
	}
	return rows, nil
}

// DailyLog returns the daily attendance log for the month, optionally
// scoped to one employee — org-wide (nil) backs the admin's calendar
// heatmap, single-employee backs the export's per-employee sheet.
func (r *ReportUsecase) DailyLog(ctx context.Context, month string, employeeID *string) ([]domain.DailyLogRow, error) {
	from, to, err := monthRange(month)
	if err != nil {
		return nil, err
	}

	records, err := r.attendance.ListForMonth(ctx, from, to)
	if err != nil {
		return nil, err
	}

	employees, err := r.users.ListActiveEmployees(ctx)
	if err != nil {
		return nil, err
	}
	employeeByID := make(map[string]*domain.User, len(employees))
	for _, e := range employees {
		employeeByID[e.ID] = e
	}

	rows := make([]domain.DailyLogRow, 0, len(records))
	for _, rec := range records {
		if employeeID != nil && rec.EmployeeID != *employeeID {
			continue
		}
		row := domain.DailyLogRow{
			Date:       rec.WorkDate,
			EmployeeID: rec.EmployeeID,
			Status:     rec.Status,
			CheckInAt:  rec.CheckInAt,
			CheckOutAt: rec.CheckOutAt,
			AutoClosed: rec.AutoClosed,
		}
		if emp, ok := employeeByID[rec.EmployeeID]; ok {
			row.FirstName = emp.FirstName
			row.LastName = emp.LastName
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func scheduleForDate(schedules []*domain.WorkSchedule, date time.Time) *domain.WorkSchedule {
	dayOfWeek := int16(date.Weekday())
	for _, s := range schedules {
		if s.DayOfWeek != dayOfWeek {
			continue
		}
		if date.Before(s.EffectiveFrom) {
			continue
		}
		if s.EffectiveTo != nil && date.After(*s.EffectiveTo) {
			continue
		}
		return s
	}
	return nil
}

func roundToOneDecimal(v float64) float64 {
	return float64(int(v*10+0.5)) / 10
}

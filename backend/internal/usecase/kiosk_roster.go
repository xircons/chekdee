package usecase

import (
	"context"

	"checkdee-backend/internal/domain"
)

// KioskRosterStats is aggregate-only, by design: no employee id, name, or
// per-person status ever leaves Stats below. Backs the kiosk lobby TV,
// which authenticates via device token (RequireKioskDevice), not a user
// JWT -- it can never call the role-gated per-employee report endpoints
// (GET /reports/daily-log), and loosening that endpoint's auth instead of
// adding this one would leak individual names/times to a public display.
type KioskRosterStats struct {
	TotalActive int
	CheckedIn   int
	Late        int
	Absent      int
	OnLeave     int
}

type KioskRosterUsecase struct {
	users      domain.UserRepository
	attendance domain.AttendanceRepository
	leaves     domain.LeaveRequestRepository
}

func NewKioskRosterUsecase(
	users domain.UserRepository,
	attendance domain.AttendanceRepository,
	leaves domain.LeaveRequestRepository,
) *KioskRosterUsecase {
	return &KioskRosterUsecase{users: users, attendance: attendance, leaves: leaves}
}

func (k *KioskRosterUsecase) Stats(ctx context.Context) (*KioskRosterStats, error) {
	employees, err := k.users.ListActiveEmployees(ctx)
	if err != nil {
		return nil, err
	}

	workDate := bangkokWorkDate(clockNow())
	records, err := k.attendance.ListForMonth(ctx, workDate, workDate.AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}

	stats := &KioskRosterStats{TotalActive: len(employees)}
	for _, r := range records {
		stats.CheckedIn++
		switch r.Status {
		case domain.AttendanceStatusLate:
			stats.Late++
		case domain.AttendanceStatusAbsent:
			stats.Absent++
		}
	}

	leaveRequests, err := k.leaves.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	todayDate := workDate.Format("2006-01-02")
	for _, l := range leaveRequests {
		if l.Status != domain.LeaveStatusApproved {
			continue
		}
		if l.StartDate.Format("2006-01-02") <= todayDate && todayDate <= l.EndDate.Format("2006-01-02") {
			stats.OnLeave++
		}
	}

	return stats, nil
}

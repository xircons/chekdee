package usecase_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

func TestComputeCheckInStatus(t *testing.T) {
	scheduledStart := time.Date(2026, 3, 2, 9, 0, 0, 0, time.UTC)

	cases := []struct {
		name      string
		checkInAt time.Time
		want      domain.AttendanceStatus
	}{
		{"early", scheduledStart.Add(-10 * time.Minute), domain.AttendanceStatusPresent},
		{"exactly on time", scheduledStart, domain.AttendanceStatusPresent},
		{"1 minute late — no grace period", scheduledStart.Add(1 * time.Minute), domain.AttendanceStatusLate},
		{"30 minutes late", scheduledStart.Add(30 * time.Minute), domain.AttendanceStatusLate},
		{"exactly 60 minutes late — still late, not absent", scheduledStart.Add(60 * time.Minute), domain.AttendanceStatusLate},
		{"61 minutes late — absent", scheduledStart.Add(61 * time.Minute), domain.AttendanceStatusAbsent},
		{"2 hours late", scheduledStart.Add(2 * time.Hour), domain.AttendanceStatusAbsent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, usecase.ComputeCheckInStatus(scheduledStart, tc.checkInAt))
		})
	}
}

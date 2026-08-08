package repository_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository"
)

// Exercises the feature/db-schema repositories end-to-end against real
// Postgres — sqlcgen's pgtype conversions (especially pgtype.Time, which
// has no direct Go equivalent) hadn't been run against a live DB before.
func TestSchemaRepositories(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	users := repository.NewUserRepository(pool)
	schedules := repository.NewWorkScheduleRepository(pool)
	holidays := repository.NewHolidayRepository(pool)
	attendance := repository.NewAttendanceRepository(pool)
	leaves := repository.NewLeaveRequestRepository(pool)
	audit := repository.NewAuditLogRepository(pool)
	ctx := context.Background()

	lineUserID := "test-schema-user-" + time.Now().Format("20060102150405.000000000")
	employee, err := users.CreateEmployeeFromLine(ctx, lineUserID, "Schema Test", "")
	require.NoError(t, err)

	adminLineID := "test-schema-admin-" + time.Now().Format("20060102150405.000000000")
	admin, err := users.CreateEmployeeFromLine(ctx, adminLineID, "Schema Admin", "")
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM admin_audit_logs WHERE actor_id = $1", admin.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM leave_requests WHERE employee_id = $1", employee.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM attendance_corrections WHERE corrected_by = $1", admin.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM attendance_records WHERE employee_id = $1", employee.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM work_schedules WHERE employee_id = $1", employee.ID)
		_, _ = pool.Exec(ctx, "DELETE FROM users WHERE id IN ($1, $2)", employee.ID, admin.ID)
	})

	t.Run("work schedule round-trips start/end time correctly", func(t *testing.T) {
		start := time.Date(0, 1, 1, 9, 30, 0, 0, time.UTC)
		end := time.Date(0, 1, 1, 17, 0, 0, 0, time.UTC)
		effectiveFrom := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

		ws, err := schedules.Create(ctx, &domain.WorkSchedule{
			EmployeeID:    employee.ID,
			DayOfWeek:     1, // Monday
			StartTime:     start,
			EndTime:       end,
			EffectiveFrom: effectiveFrom,
		})
		require.NoError(t, err)
		require.Equal(t, 9, ws.StartTime.Hour())
		require.Equal(t, 30, ws.StartTime.Minute())
		require.Equal(t, 17, ws.EndTime.Hour())

		list, err := schedules.ListForEmployee(ctx, employee.ID)
		require.NoError(t, err)
		require.Len(t, list, 1)

		require.NoError(t, schedules.Delete(ctx, ws.ID))
	})

	holidayDate := time.Date(2026, 12, 5, 0, 0, 0, 0, time.UTC)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, "DELETE FROM holidays WHERE date = $1", holidayDate)
	})

	t.Run("holiday sync then manual edit is preserved on re-sync", func(t *testing.T) {
		h, err := holidays.UpsertSynced(ctx, holidayDate, "Test Holiday", "วันทดสอบ")
		require.NoError(t, err)
		require.Equal(t, domain.HolidaySourceNagerDate, h.Source)

		edited, err := holidays.UpsertManual(ctx, holidayDate, "Test Holiday (edited)", "วันทดสอบ (แก้ไข)", admin.ID)
		require.NoError(t, err)
		require.Equal(t, domain.HolidaySourceManual, edited.Source)
		require.NotNil(t, edited.UpdatedBy)
		require.Equal(t, admin.ID, *edited.UpdatedBy)

		// Re-sync must NOT clobber the manual edit.
		resynced, err := holidays.UpsertSynced(ctx, holidayDate, "Test Holiday (from API)", "")
		require.NoError(t, err)
		require.Equal(t, "Test Holiday (edited)", resynced.Name)

		list, err := holidays.ListInRange(ctx, holidayDate, holidayDate)
		require.NoError(t, err)
		require.Len(t, list, 1)
	})

	var attendanceRecordID string
	t.Run("check-in, check-out, and a correction", func(t *testing.T) {
		lat, lng, acc := 18.79623, 98.9531, 12.5
		status := domain.AttendanceStatusPresent

		rec, err := attendance.CreateCheckIn(ctx, &domain.AttendanceRecord{
			EmployeeID:       employee.ID,
			WorkDate:         time.Date(2026, 8, 10, 0, 0, 0, 0, time.UTC),
			CheckInAt:        ptrTime(time.Now()),
			CheckInLat:       &lat,
			CheckInLng:       &lng,
			CheckInAccuracyM: &acc,
			Status:           &status,
		})
		require.NoError(t, err)
		require.NotNil(t, rec.CheckInLat)
		require.InDelta(t, lat, *rec.CheckInLat, 0.0001)
		require.Equal(t, domain.AttendanceStatusPresent, *rec.Status)
		attendanceRecordID = rec.ID

		fetched, err := attendance.GetByEmployeeAndDate(ctx, employee.ID, rec.WorkDate)
		require.NoError(t, err)
		require.Equal(t, rec.ID, fetched.ID)

		checkedOut, err := attendance.SetCheckOut(ctx, rec.ID, time.Now())
		require.NoError(t, err)
		require.NotNil(t, checkedOut.CheckOutAt)

		correction, err := attendance.CreateCorrection(ctx, &domain.AttendanceCorrection{
			AttendanceRecordID: rec.ID,
			CorrectedBy:        admin.ID,
			FieldName:          "check_out_at",
			OldValue:           strPtr("2026-08-10T17:00:00Z"),
			NewValue:           strPtr("2026-08-10T18:00:00Z"),
			Reason:             strPtr("employee forgot to check out on time"),
		})
		require.NoError(t, err)

		corrections, err := attendance.ListCorrectionsForRecord(ctx, rec.ID)
		require.NoError(t, err)
		require.Len(t, corrections, 1)
		require.Equal(t, correction.ID, corrections[0].ID)
	})

	t.Run("leave request create, approve, and token lookup", func(t *testing.T) {
		tokenHash := "test-leave-token-" + time.Now().Format("20060102150405.000000000")
		lr, err := leaves.Create(ctx, &domain.LeaveRequest{
			EmployeeID:             employee.ID,
			StartDate:              time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
			EndDate:                time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC),
			Reason:                 strPtr("personal"),
			ApprovalTokenHash:      &tokenHash,
			ApprovalTokenExpiresAt: ptrTime(time.Now().Add(48 * time.Hour)),
		})
		require.NoError(t, err)
		require.Equal(t, domain.LeaveStatusPending, lr.Status)

		byToken, err := leaves.GetByApprovalTokenHash(ctx, tokenHash)
		require.NoError(t, err)
		require.Equal(t, lr.ID, byToken.ID)

		decided, err := leaves.Decide(ctx, lr.ID, domain.LeaveStatusApproved, admin.ID, "127.0.0.1")
		require.NoError(t, err)
		require.Equal(t, domain.LeaveStatusApproved, decided.Status)
		require.Nil(t, decided.ApprovalTokenHash) // cleared on decision

		// A decided request's token is gone, so the approval link 404s on reuse.
		_, err = leaves.GetByApprovalTokenHash(ctx, tokenHash)
		require.ErrorIs(t, err, domain.ErrLeaveRequestNotFound)

		list, err := leaves.ListForEmployee(ctx, employee.ID)
		require.NoError(t, err)
		require.Len(t, list, 1)
	})

	t.Run("admin audit log", func(t *testing.T) {
		targetType := "attendance_record"
		log, err := audit.Create(ctx, &domain.AdminAuditLog{
			ActorID:    admin.ID,
			Action:     "attendance.corrected",
			TargetType: &targetType,
			TargetID:   &attendanceRecordID,
			Reason:     strPtr("test"),
			Metadata:   []byte(`{"field":"check_out_at"}`),
		})
		require.NoError(t, err)

		list, err := audit.ListForTarget(ctx, targetType, attendanceRecordID)
		require.NoError(t, err)
		require.Len(t, list, 1)
		require.Equal(t, log.ID, list[0].ID)
	})
}

func ptrTime(t time.Time) *time.Time { return &t }
func strPtr(s string) *string        { return &s }

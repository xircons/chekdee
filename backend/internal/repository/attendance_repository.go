package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository/sqlcgen"
)

// AttendanceRepository implements domain.AttendanceRepository using the
// sqlc-generated Queries — unlike the hand-rolled UserRepository (written
// before sqlc had actually been run in this environment), this one
// delegates to generated code as intended.
type AttendanceRepository struct {
	q *sqlcgen.Queries
}

func NewAttendanceRepository(pool *pgxpool.Pool) *AttendanceRepository {
	return &AttendanceRepository{q: sqlcgen.New(pool)}
}

func toAttendanceStatusPtr(s sqlcgen.NullAttendanceStatus) *domain.AttendanceStatus {
	if !s.Valid {
		return nil
	}
	status := domain.AttendanceStatus(s.AttendanceStatus)
	return &status
}

func fromAttendanceStatusPtr(s *domain.AttendanceStatus) sqlcgen.NullAttendanceStatus {
	if s == nil {
		return sqlcgen.NullAttendanceStatus{}
	}
	return sqlcgen.NullAttendanceStatus{AttendanceStatus: sqlcgen.AttendanceStatus(*s), Valid: true}
}

func toAttendanceRecord(r sqlcgen.AttendanceRecord) *domain.AttendanceRecord {
	return &domain.AttendanceRecord{
		ID:               uuidToString(r.ID),
		EmployeeID:       uuidToString(r.EmployeeID),
		WorkDate:         dateToTime(r.WorkDate),
		CheckInAt:        timestamptzToTimePtr(r.CheckInAt),
		CheckInLat:       float8ToPtr(r.CheckInLat),
		CheckInLng:       float8ToPtr(r.CheckInLng),
		CheckInAccuracyM: float8ToPtr(r.CheckInAccuracyM),
		CheckOutAt:       timestamptzToTimePtr(r.CheckOutAt),
		Status:           toAttendanceStatusPtr(r.Status),
		AutoClosed:       r.AutoClosed,
		CreatedAt:        timestamptzToTime(r.CreatedAt),
		UpdatedAt:        timestamptzToTime(r.UpdatedAt),
	}
}

func (r *AttendanceRepository) CreateCheckIn(ctx context.Context, rec *domain.AttendanceRecord) (*domain.AttendanceRecord, error) {
	row, err := r.q.CreateCheckIn(ctx, sqlcgen.CreateCheckInParams{
		EmployeeID:       stringToUUID(rec.EmployeeID),
		WorkDate:         timeToDate(rec.WorkDate),
		CheckInAt:        timePtrToTimestamptz(rec.CheckInAt),
		CheckInLat:       ptrToFloat8(rec.CheckInLat),
		CheckInLng:       ptrToFloat8(rec.CheckInLng),
		CheckInAccuracyM: ptrToFloat8(rec.CheckInAccuracyM),
		Status:           fromAttendanceStatusPtr(rec.Status),
	})
	if err != nil {
		return nil, err
	}
	return toAttendanceRecord(row), nil
}

func (r *AttendanceRepository) GetByEmployeeAndDate(ctx context.Context, employeeID string, workDate time.Time) (*domain.AttendanceRecord, error) {
	row, err := r.q.GetAttendanceRecordByEmployeeAndDate(ctx, sqlcgen.GetAttendanceRecordByEmployeeAndDateParams{
		EmployeeID: stringToUUID(employeeID),
		WorkDate:   timeToDate(workDate),
	})
	if err != nil {
		return nil, mapNoRows(err, domain.ErrAttendanceRecordNotFound)
	}
	return toAttendanceRecord(row), nil
}

func (r *AttendanceRepository) SetCheckOut(ctx context.Context, id string, checkOutAt time.Time) (*domain.AttendanceRecord, error) {
	row, err := r.q.SetCheckOut(ctx, sqlcgen.SetCheckOutParams{
		ID:         stringToUUID(id),
		CheckOutAt: timeToTimestamptz(checkOutAt),
	})
	if err != nil {
		return nil, err
	}
	return toAttendanceRecord(row), nil
}

func (r *AttendanceRepository) AutoClose(ctx context.Context, id string, checkOutAt time.Time) (*domain.AttendanceRecord, error) {
	row, err := r.q.AutoCloseAttendanceRecord(ctx, sqlcgen.AutoCloseAttendanceRecordParams{
		ID:         stringToUUID(id),
		CheckOutAt: timeToTimestamptz(checkOutAt),
	})
	if err != nil {
		return nil, err
	}
	return toAttendanceRecord(row), nil
}

func (r *AttendanceRepository) ListOpenBefore(ctx context.Context, before time.Time) ([]*domain.AttendanceRecord, error) {
	rows, err := r.q.ListOpenAttendanceRecordsBeforeDate(ctx, timeToDate(before))
	if err != nil {
		return nil, err
	}
	out := make([]*domain.AttendanceRecord, 0, len(rows))
	for _, row := range rows {
		out = append(out, toAttendanceRecord(row))
	}
	return out, nil
}

func (r *AttendanceRepository) CreateCorrection(ctx context.Context, c *domain.AttendanceCorrection) (*domain.AttendanceCorrection, error) {
	row, err := r.q.CreateAttendanceCorrection(ctx, sqlcgen.CreateAttendanceCorrectionParams{
		AttendanceRecordID: stringToUUID(c.AttendanceRecordID),
		CorrectedBy:        stringToUUID(c.CorrectedBy),
		FieldName:          c.FieldName,
		OldValue:           stringPtrToText(c.OldValue),
		NewValue:           stringPtrToText(c.NewValue),
		Reason:             stringPtrToText(c.Reason),
	})
	if err != nil {
		return nil, err
	}
	return toAttendanceCorrection(row), nil
}

func toAttendanceCorrection(c sqlcgen.AttendanceCorrection) *domain.AttendanceCorrection {
	return &domain.AttendanceCorrection{
		ID:                 uuidToString(c.ID),
		AttendanceRecordID: uuidToString(c.AttendanceRecordID),
		CorrectedBy:        uuidToString(c.CorrectedBy),
		FieldName:          c.FieldName,
		OldValue:           textToStringPtr(c.OldValue),
		NewValue:           textToStringPtr(c.NewValue),
		Reason:             textToStringPtr(c.Reason),
		CreatedAt:          timestamptzToTime(c.CreatedAt),
	}
}

func (r *AttendanceRepository) ListCorrectionsForRecord(ctx context.Context, attendanceRecordID string) ([]*domain.AttendanceCorrection, error) {
	rows, err := r.q.ListAttendanceCorrectionsForRecord(ctx, stringToUUID(attendanceRecordID))
	if err != nil {
		return nil, err
	}
	out := make([]*domain.AttendanceCorrection, 0, len(rows))
	for _, row := range rows {
		out = append(out, toAttendanceCorrection(row))
	}
	return out, nil
}

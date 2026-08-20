package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/qrsign"
	"checkdee-backend/internal/usecase"
)

type fakeAttendanceRepo struct {
	checkInCalls int
	lastStatus   domain.AttendanceStatus
	cachedByKey  map[string]*domain.AttendanceRecord
}

func (f *fakeAttendanceRepo) GetForEmployeeDate(context.Context, string, time.Time) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepo) GetByIdempotencyKey(_ context.Context, key string) (*domain.AttendanceRecord, error) {
	return f.cachedByKey[key], nil
}
func (f *fakeAttendanceRepo) CheckIn(_ context.Context, employeeID string, workDate, checkInAt time.Time, status domain.AttendanceStatus, _ string) (*domain.AttendanceRecord, error) {
	f.checkInCalls++
	f.lastStatus = status
	return &domain.AttendanceRecord{ID: "rec-1", EmployeeID: employeeID, WorkDate: workDate, CheckInAt: &checkInAt, Status: status}, nil
}
func (f *fakeAttendanceRepo) CheckOut(context.Context, string, time.Time, time.Time, string) (*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepo) AutoCloseOpenRecords(context.Context, time.Time) ([]*domain.AttendanceRecord, error) {
	return nil, nil
}
func (f *fakeAttendanceRepo) ListForMonth(context.Context, time.Time, time.Time) ([]*domain.AttendanceRecord, error) {
	return nil, nil
}

type fakeScheduleRepo struct {
	schedules []*domain.WorkSchedule
}

func (f *fakeScheduleRepo) ListForEmployee(context.Context, string) ([]*domain.WorkSchedule, error) {
	return f.schedules, nil
}
func (f *fakeScheduleRepo) ReplaceForEmployee(context.Context, string, []*domain.WorkSchedule) ([]*domain.WorkSchedule, error) {
	return nil, nil
}

type fakeKioskDeviceRepo struct {
	activeDeviceIDs map[string]bool
}

func (f *fakeKioskDeviceRepo) Create(context.Context, string, string, string) (*domain.KioskDevice, error) {
	return nil, nil
}
func (f *fakeKioskDeviceRepo) Rotate(context.Context, string, string) (*domain.KioskDevice, error) {
	return nil, nil
}
func (f *fakeKioskDeviceRepo) Revoke(context.Context, string) error { return nil }
func (f *fakeKioskDeviceRepo) GetActiveByTokenHash(context.Context, string) (*domain.KioskDevice, error) {
	return nil, nil
}
func (f *fakeKioskDeviceRepo) GetActiveByDeviceID(_ context.Context, deviceID string) (*domain.KioskDevice, error) {
	if f.activeDeviceIDs[deviceID] {
		return &domain.KioskDevice{DeviceID: deviceID}, nil
	}
	return nil, domain.ErrKioskDeviceNotFound
}
func (f *fakeKioskDeviceRepo) ListActive(context.Context) ([]*domain.KioskDevice, error) {
	return nil, nil
}

type fakeQRNonceRepo struct {
	consumed     map[string]bool
	consumeCalls int
}

func (f *fakeQRNonceRepo) Consume(_ context.Context, nonce, _ string, _ time.Time) error {
	f.consumeCalls++
	if f.consumed == nil {
		f.consumed = map[string]bool{}
	}
	if f.consumed[nonce] {
		return domain.ErrNonceAlreadyConsumed
	}
	f.consumed[nonce] = true
	return nil
}

func newAttendanceUsecase(t *testing.T, attendance *fakeAttendanceRepo, schedules *fakeScheduleRepo, devices *fakeKioskDeviceRepo, nonces *fakeQRNonceRepo) (*usecase.AttendanceUsecase, *qrsign.Signer) {
	t.Helper()
	signer := qrsign.NewSigner("test-secret")
	return usecase.NewAttendanceUsecase(attendance, schedules, devices, nonces, signer), signer
}

func TestAttendanceUsecase_CheckIn_Success(t *testing.T) {
	attendance := &fakeAttendanceRepo{}
	devices := &fakeKioskDeviceRepo{activeDeviceIDs: map[string]bool{"device-1": true}}
	nonces := &fakeQRNonceRepo{}
	uc, signer := newAttendanceUsecase(t, attendance, &fakeScheduleRepo{}, devices, nonces)

	token, _, _, err := signer.Sign("device-1", usecase.QRTokenTTL)
	require.NoError(t, err)

	rec, err := uc.CheckIn(context.Background(), "employee-1", token, "key-1")
	require.NoError(t, err)
	require.Equal(t, "employee-1", rec.EmployeeID)
	require.Equal(t, 1, attendance.checkInCalls)
	// No matching schedule in fakeScheduleRepo -> falls back to present.
	require.Equal(t, domain.AttendanceStatusPresent, attendance.lastStatus)
}

func TestAttendanceUsecase_CheckIn_InvalidToken(t *testing.T) {
	attendance := &fakeAttendanceRepo{}
	uc, _ := newAttendanceUsecase(t, attendance, &fakeScheduleRepo{}, &fakeKioskDeviceRepo{}, &fakeQRNonceRepo{})

	_, err := uc.CheckIn(context.Background(), "employee-1", "not-a-valid-token", "key-1")
	require.ErrorIs(t, err, qrsign.ErrInvalidToken)
	require.Zero(t, attendance.checkInCalls)
}

func TestAttendanceUsecase_CheckIn_ExpiredToken(t *testing.T) {
	attendance := &fakeAttendanceRepo{}
	uc, signer := newAttendanceUsecase(t, attendance, &fakeScheduleRepo{}, &fakeKioskDeviceRepo{}, &fakeQRNonceRepo{})

	token, _, _, err := signer.Sign("device-1", -1*time.Second)
	require.NoError(t, err)

	_, err = uc.CheckIn(context.Background(), "employee-1", token, "key-1")
	require.ErrorIs(t, err, qrsign.ErrInvalidToken)
	require.Zero(t, attendance.checkInCalls)
}

func TestAttendanceUsecase_CheckIn_InactiveDevice(t *testing.T) {
	attendance := &fakeAttendanceRepo{}
	devices := &fakeKioskDeviceRepo{activeDeviceIDs: map[string]bool{}} // device-1 not active
	uc, signer := newAttendanceUsecase(t, attendance, &fakeScheduleRepo{}, devices, &fakeQRNonceRepo{})

	token, _, _, err := signer.Sign("device-1", usecase.QRTokenTTL)
	require.NoError(t, err)

	_, err = uc.CheckIn(context.Background(), "employee-1", token, "key-1")
	require.ErrorIs(t, err, domain.ErrKioskDeviceNotFound)
	require.Zero(t, attendance.checkInCalls)
}

func TestAttendanceUsecase_CheckIn_ReplayedNonceRejected(t *testing.T) {
	attendance := &fakeAttendanceRepo{}
	devices := &fakeKioskDeviceRepo{activeDeviceIDs: map[string]bool{"device-1": true}}
	nonces := &fakeQRNonceRepo{}
	uc, signer := newAttendanceUsecase(t, attendance, &fakeScheduleRepo{}, devices, nonces)

	token, _, _, err := signer.Sign("device-1", usecase.QRTokenTTL)
	require.NoError(t, err)

	_, err = uc.CheckIn(context.Background(), "employee-1", token, "key-1")
	require.NoError(t, err)

	// Same token (same nonce) presented again by a second phone.
	_, err = uc.CheckIn(context.Background(), "employee-2", token, "key-2")
	require.ErrorIs(t, err, domain.ErrNonceAlreadyConsumed)
	require.Equal(t, 1, attendance.checkInCalls, "the replayed scan must never reach the attendance write")
}

func TestAttendanceUsecase_CheckIn_LateStatusFromSchedule(t *testing.T) {
	attendance := &fakeAttendanceRepo{}
	devices := &fakeKioskDeviceRepo{activeDeviceIDs: map[string]bool{"device-1": true}}

	// Anchored to Bangkok wall-clock explicitly, not the test host's local
	// zone: the usecase now interprets a schedule's start_time as Bangkok
	// time regardless of ambient location (see bangkokLocation's doc comment
	// in attendance.go for the bug this fixes), so the test must compute its
	// expected "2 hours ago" the same way or it'll be right only by
	// coincidence on a host whose local zone happens to be Bangkok.
	bangkok, err := time.LoadLocation("Asia/Bangkok")
	require.NoError(t, err)
	nowBangkok := time.Now().In(bangkok)
	dayOfWeek := int16(nowBangkok.Weekday())
	// Scheduled to start 2 hours before "now" so this check-in lands well
	// past the 60-minute absent threshold.
	scheduledStart := nowBangkok.Add(-2 * time.Hour)
	schedules := &fakeScheduleRepo{schedules: []*domain.WorkSchedule{
		{
			DayOfWeek:     dayOfWeek,
			StartTime:     time.Date(0, 1, 1, scheduledStart.Hour(), scheduledStart.Minute(), 0, 0, time.UTC),
			EndTime:       time.Date(0, 1, 1, 23, 0, 0, 0, time.UTC),
			EffectiveFrom: nowBangkok.Add(-30 * 24 * time.Hour),
		},
	}}
	uc, signer := newAttendanceUsecase(t, attendance, schedules, devices, &fakeQRNonceRepo{})

	token, _, _, err := signer.Sign("device-1", usecase.QRTokenTTL)
	require.NoError(t, err)

	_, err = uc.CheckIn(context.Background(), "employee-1", token, "key-1")
	require.NoError(t, err)
	require.Equal(t, domain.AttendanceStatusAbsent, attendance.lastStatus)
}

// TestAttendanceUsecase_CheckIn_RetryWithSameKeyNeverTouchesNonce is a
// regression test: the idempotency check must happen before QR nonce
// consumption, not after (inside the repository transaction) — a nonce is
// single-use, so a retry that reaches nonce consumption a second time would
// get rejected as a replay instead of returning the cached result, defeating
// the whole point of the idempotency key. Caught by live smoke testing.
func TestAttendanceUsecase_CheckIn_RetryWithSameKeyNeverTouchesNonce(t *testing.T) {
	cached := &domain.AttendanceRecord{ID: "rec-cached", EmployeeID: "employee-1"}
	attendance := &fakeAttendanceRepo{cachedByKey: map[string]*domain.AttendanceRecord{"retry-key": cached}}
	devices := &fakeKioskDeviceRepo{activeDeviceIDs: map[string]bool{"device-1": true}}
	nonces := &fakeQRNonceRepo{}
	uc, signer := newAttendanceUsecase(t, attendance, &fakeScheduleRepo{}, devices, nonces)

	token, _, _, err := signer.Sign("device-1", usecase.QRTokenTTL)
	require.NoError(t, err)

	rec, err := uc.CheckIn(context.Background(), "employee-1", token, "retry-key")
	require.NoError(t, err)
	require.Equal(t, cached, rec)
	require.Zero(t, nonces.consumeCalls, "a cached-key retry must never attempt to consume the nonce")
	require.Zero(t, attendance.checkInCalls, "a cached-key retry must never re-run the attendance write")
}

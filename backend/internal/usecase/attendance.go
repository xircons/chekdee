package usecase

import (
	"context"
	"sync"
	"time"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/qrsign"
)

// QRTokenTTL is how long a minted QR payload is valid — the kiosk TV
// re-mints (and the frontend re-renders) one every 15s.
const QRTokenTTL = 15 * time.Second

var (
	ErrInvalidQRToken  = qrsign.ErrInvalidToken
	ErrDeviceNotActive = domain.ErrKioskDeviceNotFound
)

// clockNow is indirected through a package variable, not called as
// time.Now() directly, so a test can substitute a fixed instant — see
// SetClockForTest and TestAttendanceUsecase_CheckIn_LateStatusFromSchedule,
// which needs a deterministic "now" to test the late/absent threshold: a
// same-day work schedule can't represent ">60 minutes late" if fewer than
// 60 minutes of the Bangkok calendar day have elapsed yet, which made a
// time.Now()-based version of that test flaky for roughly the first hour
// after Bangkok midnight. Production never overrides this.
var clockNow = time.Now

// SetClockForTest overrides the clock CheckIn/CheckOut use to determine
// "now". Returns a reset func restoring the previous clock — call it via
// t.Cleanup. Test-only; not for production use.
func SetClockForTest(fn func() time.Time) (reset func()) {
	prev := clockNow
	clockNow = fn
	return func() { clockNow = prev }
}

type AttendanceUsecase struct {
	attendance domain.AttendanceRepository
	schedules  domain.WorkScheduleRepository
	devices    domain.KioskDeviceRepository
	nonces     domain.QRNonceRepository
	signer     *qrsign.Signer
}

func NewAttendanceUsecase(
	attendance domain.AttendanceRepository,
	schedules domain.WorkScheduleRepository,
	devices domain.KioskDeviceRepository,
	nonces domain.QRNonceRepository,
	signer *qrsign.Signer,
) *AttendanceUsecase {
	return &AttendanceUsecase{attendance: attendance, schedules: schedules, devices: devices, nonces: nonces, signer: signer}
}

// MintQRToken is called by the kiosk route (device-token authenticated) to
// get the next rotating QR payload for its screen.
func (a *AttendanceUsecase) MintQRToken(ctx context.Context, deviceID string) (token string, expiresAt time.Time, err error) {
	token, _, expiresAt, err = a.signer.Sign(deviceID, QRTokenTTL)
	return token, expiresAt, err
}

// CheckIn verifies the scanned QR token (signature, expiry, single-use),
// confirms the embedded device is still active, computes the no-grace-period
// late/absent status against the employee's schedule for today, and records
// the check-in. idempotencyKey makes a retried submit safe to resend.
//
// Nonce consumption and the attendance write are deliberately not one DB
// transaction (different repositories/pools) — a request that consumes the
// nonce but then fails the attendance write (e.g. already checked in) wastes
// that single QR scan rather than corrupting data. Accepted tradeoff: worst
// case is waiting for the next 15s rotation, not a correctness issue.
func (a *AttendanceUsecase) CheckIn(ctx context.Context, employeeID, qrToken, idempotencyKey string) (*domain.AttendanceRecord, error) {
	// Checked before the QR is touched at all: nonce consumption is a
	// side effect a second attempt can't safely repeat (the nonce is
	// single-use), so a retry with the same idempotency key must short-
	// circuit here, not reach the QR checks and get rejected as a replay.
	if cached, err := a.attendance.GetByIdempotencyKey(ctx, idempotencyKey); err != nil {
		return nil, err
	} else if cached != nil {
		return cached, nil
	}

	deviceID, nonce, err := a.signer.Verify(qrToken)
	if err != nil {
		return nil, err
	}

	if _, err := a.devices.GetActiveByDeviceID(ctx, deviceID); err != nil {
		return nil, err
	}

	// Nonce's own expiry, independent of QRTokenTTL, so consumed_qr_nonces
	// rows can be pruned safely.
	if err := a.nonces.Consume(ctx, nonce, deviceID, time.Now().Add(QRTokenTTL)); err != nil {
		return nil, err
	}

	now := clockNow()
	workDate := bangkokWorkDate(now)

	status, err := a.computeStatus(ctx, employeeID, workDate, now)
	if err != nil {
		return nil, err
	}

	return a.attendance.CheckIn(ctx, employeeID, workDate, now, status, idempotencyKey)
}

// CheckOut is a plain in-app action — no QR, no camera step, per the flow
// update that replaced the original checkout design.
func (a *AttendanceUsecase) CheckOut(ctx context.Context, employeeID, idempotencyKey string) (*domain.AttendanceRecord, error) {
	now := clockNow()
	workDate := bangkokWorkDate(now)
	return a.attendance.CheckOut(ctx, employeeID, workDate, now, idempotencyKey)
}

// CorrectStatus is the admin manual-correction action — thin pass-through
// to the repository, which handles the update + audit-row atomicity.
// Authorization (admin/supervisor/system_owner only) is the handler's
// RequireRole middleware, not this usecase's job.
func (a *AttendanceUsecase) CorrectStatus(ctx context.Context, attendanceRecordID, correctedBy string, newStatus domain.AttendanceStatus, reason string) (*domain.AttendanceRecord, error) {
	return a.attendance.CorrectStatus(ctx, attendanceRecordID, correctedBy, newStatus, reason)
}

// computeStatus applies the no-grace-period rule: 0 minutes late or earlier
// is present, up to 60 minutes late is late, over 60 (or no matching
// schedule at all, so lateness can't be judged) falls back — see
// ComputeCheckInStatus's doc for the exact thresholds, matched to the
// frontend's already-shipped computeAttendanceStatus.
func (a *AttendanceUsecase) computeStatus(ctx context.Context, employeeID string, workDate, checkInAt time.Time) (domain.AttendanceStatus, error) {
	schedules, err := a.schedules.ListForEmployee(ctx, employeeID)
	if err != nil {
		return "", err
	}

	dayOfWeek := int16(workDate.Weekday())
	for _, s := range schedules {
		if s.DayOfWeek != dayOfWeek {
			continue
		}
		if workDate.Before(s.EffectiveFrom) {
			continue
		}
		if s.EffectiveTo != nil && workDate.After(*s.EffectiveTo) {
			continue
		}
		scheduledStart := scheduledTimeOn(workDate, s.StartTime)
		return ComputeCheckInStatus(scheduledStart, checkInAt), nil
	}

	// No matching schedule row — nothing to judge lateness against.
	return domain.AttendanceStatusPresent, nil
}

// ComputeCheckInStatus is the no-grace-period late/absent rule: lateMinutes
// <= 0 is present, <= 60 is late (สาย), otherwise absent (ขาด) — exactly the
// thresholds already shipped in the frontend's computeAttendanceStatus.
func ComputeCheckInStatus(scheduledStart, checkInAt time.Time) domain.AttendanceStatus {
	lateMinutes := checkInAt.Sub(scheduledStart).Minutes()
	switch {
	case lateMinutes <= 0:
		return domain.AttendanceStatusPresent
	case lateMinutes <= 60:
		return domain.AttendanceStatusLate
	default:
		return domain.AttendanceStatusAbsent
	}
}

// bangkokLocation is loaded once per process — every wall-clock computation
// in this package (work_date, and work_schedules.start_time/end_time, which
// are Bangkok local times with no timezone of their own) must anchor to this
// explicit zone, never to a caller's ambient time.Time.Location(). That
// ambient-location mistake was an actual bug here: scheduledStart used to be
// built from checkInAt.Location() — checkInAt is time.Now(), whose Location
// is the server process's local zone. On a dev machine already set to
// Asia/Bangkok this silently worked; on a UTC-configured production
// container (the normal case) it would have shifted every scheduled-start
// comparison by the server's UTC offset, corrupting the late/absent
// classification. Caught while adding the same construction in Reports.
var bangkokLocation = sync.OnceValue(func() *time.Location {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		return time.FixedZone("Asia/Bangkok", 7*60*60)
	}
	return loc
})

func bangkokWorkDate(t time.Time) time.Time {
	local := t.In(bangkokLocation())
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

// scheduledTimeOn combines a work_date and a work_schedules start_time/
// end_time (both naive values with no real timezone attached by pgx) into
// the actual Bangkok-local instant they represent.
func scheduledTimeOn(date, timeOfDay time.Time) time.Time {
	return time.Date(
		date.Year(), date.Month(), date.Day(),
		timeOfDay.Hour(), timeOfDay.Minute(), timeOfDay.Second(), 0,
		bangkokLocation(),
	)
}

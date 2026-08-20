package usecase

import (
	"context"
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

	now := time.Now()
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
	now := time.Now()
	workDate := bangkokWorkDate(now)
	return a.attendance.CheckOut(ctx, employeeID, workDate, now, idempotencyKey)
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
		scheduledStart := time.Date(
			workDate.Year(), workDate.Month(), workDate.Day(),
			s.StartTime.Hour(), s.StartTime.Minute(), s.StartTime.Second(), 0,
			checkInAt.Location(),
		)
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

func bangkokWorkDate(t time.Time) time.Time {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		loc = time.FixedZone("Asia/Bangkok", 7*60*60)
	}
	local := t.In(loc)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

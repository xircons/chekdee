package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/qrsign"
	"checkdee-backend/internal/usecase"
)

type AttendanceHandler struct {
	attendance *usecase.AttendanceUsecase
}

func NewAttendanceHandler(attendance *usecase.AttendanceUsecase) *AttendanceHandler {
	return &AttendanceHandler{attendance: attendance}
}

type attendanceRecordView struct {
	ID         string  `json:"id"`
	EmployeeID string  `json:"employee_id"`
	WorkDate   string  `json:"work_date"`
	CheckInAt  *string `json:"check_in_at"`
	CheckOutAt *string `json:"check_out_at"`
	Status     string  `json:"status"`
	AutoClosed bool    `json:"auto_closed"`
}

func toAttendanceRecordView(a *domain.AttendanceRecord) attendanceRecordView {
	v := attendanceRecordView{
		ID:         a.ID,
		EmployeeID: a.EmployeeID,
		WorkDate:   a.WorkDate.Format(dateLayout),
		Status:     string(a.Status),
		AutoClosed: a.AutoClosed,
	}
	if a.CheckInAt != nil {
		s := a.CheckInAt.Format(timeOfDayLayout)
		v.CheckInAt = &s
	}
	if a.CheckOutAt != nil {
		s := a.CheckOutAt.Format(timeOfDayLayout)
		v.CheckOutAt = &s
	}
	return v
}

// Today returns the caller's own attendance record for today, or `null` if
// they haven't checked in yet -- not a 404, since "no record yet" is the
// normal pre-check-in state, not an error. Mounted behind RequireAuth.
func (h *AttendanceHandler) Today(c echo.Context) error {
	record, err := h.attendance.Today(c.Request().Context(), userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load today's attendance")
	}
	if record == nil {
		return c.JSON(http.StatusOK, nil)
	}
	return c.JSON(http.StatusOK, toAttendanceRecordView(record))
}

type checkInRequest struct {
	QRToken        string `json:"qr_token"`
	IdempotencyKey string `json:"idempotency_key"`
}

// CheckIn verifies a scanned QR payload and records the check-in. Mounted
// behind RequireAuth — any authenticated employee checks in for themselves.
func (h *AttendanceHandler) CheckIn(c echo.Context) error {
	var req checkInRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.QRToken == "" || req.IdempotencyKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "qr_token and idempotency_key are required")
	}

	record, err := h.attendance.CheckIn(c.Request().Context(), userIDFromContext(c), req.QRToken, req.IdempotencyKey)
	switch {
	case errors.Is(err, qrsign.ErrInvalidToken):
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired qr code")
	case errors.Is(err, domain.ErrNonceAlreadyConsumed):
		return echo.NewHTTPError(http.StatusConflict, "qr code already used — scan the current one")
	case errors.Is(err, domain.ErrKioskDeviceNotFound):
		return echo.NewHTTPError(http.StatusUnauthorized, "kiosk device is not active")
	case errors.Is(err, domain.ErrAlreadyCheckedIn):
		return echo.NewHTTPError(http.StatusConflict, "already checked in today")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "check-in failed")
	}
	return c.JSON(http.StatusOK, toAttendanceRecordView(record))
}

type checkOutRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
}

// CheckOut is a plain in-app action — no QR, no camera step. Mounted behind
// RequireAuth.
func (h *AttendanceHandler) CheckOut(c echo.Context) error {
	var req checkOutRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.IdempotencyKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "idempotency_key is required")
	}

	record, err := h.attendance.CheckOut(c.Request().Context(), userIDFromContext(c), req.IdempotencyKey)
	switch {
	case errors.Is(err, domain.ErrNotCheckedIn):
		return echo.NewHTTPError(http.StatusConflict, "not checked in today")
	case errors.Is(err, domain.ErrAlreadyCheckedOut):
		return echo.NewHTTPError(http.StatusConflict, "already checked out today")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "check-out failed")
	}
	return c.JSON(http.StatusOK, toAttendanceRecordView(record))
}

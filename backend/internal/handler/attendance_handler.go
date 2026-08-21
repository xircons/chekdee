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
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดข้อมูลเข้างานวันนี้ไม่สำเร็จ")
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
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.QRToken == "" || req.IdempotencyKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุ qr_token และ idempotency_key")
	}

	record, err := h.attendance.CheckIn(c.Request().Context(), userIDFromContext(c), req.QRToken, req.IdempotencyKey)
	switch {
	case errors.Is(err, qrsign.ErrInvalidToken):
		return echo.NewHTTPError(http.StatusUnauthorized, "QR หมดอายุแล้ว กรุณาสแกนใหม่อีกครั้ง")
	case errors.Is(err, domain.ErrNonceAlreadyConsumed):
		return echo.NewHTTPError(http.StatusConflict, "QR นี้ถูกใช้ไปแล้ว กรุณาสแกนรหัสปัจจุบันอีกครั้ง")
	case errors.Is(err, domain.ErrKioskDeviceNotFound):
		return echo.NewHTTPError(http.StatusUnauthorized, "อุปกรณ์นี้ถูกเพิกถอนแล้ว")
	case errors.Is(err, domain.ErrAlreadyCheckedIn):
		return echo.NewHTTPError(http.StatusConflict, "เช็คอินไปแล้ววันนี้")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "เช็คอินไม่สำเร็จ")
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
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.IdempotencyKey == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุ idempotency_key")
	}

	record, err := h.attendance.CheckOut(c.Request().Context(), userIDFromContext(c), req.IdempotencyKey)
	switch {
	case errors.Is(err, domain.ErrNotCheckedIn):
		return echo.NewHTTPError(http.StatusConflict, "ยังไม่ได้เช็คอินวันนี้")
	case errors.Is(err, domain.ErrAlreadyCheckedOut):
		return echo.NewHTTPError(http.StatusConflict, "เช็คเอาต์ไปแล้ววันนี้")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "เช็คเอาต์ไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toAttendanceRecordView(record))
}

var correctableStatuses = map[string]domain.AttendanceStatus{
	"present": domain.AttendanceStatusPresent,
	"late":    domain.AttendanceStatusLate,
	"absent":  domain.AttendanceStatusAbsent,
}

type correctAttendanceStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

// CorrectStatus is the admin manual-correction action -- updates a specific
// attendance record's status and writes a structured audit row (migration
// 000003's attendance_corrections table). Mounted behind RequireRole
// (admin/supervisor/system_owner), matching the schedules/holidays
// mutation trio.
func (h *AttendanceHandler) CorrectStatus(c echo.Context) error {
	var req correctAttendanceStatusRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	status, ok := correctableStatuses[req.Status]
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "สถานะต้องเป็น present, late หรือ absent")
	}
	if req.Reason == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุเหตุผล")
	}

	record, err := h.attendance.CorrectStatus(c.Request().Context(), c.Param("id"), userIDFromContext(c), status, req.Reason)
	switch {
	case errors.Is(err, domain.ErrAttendanceRecordNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบบันทึกการเข้างาน")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "แก้ไขข้อมูลไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toAttendanceRecordView(record))
}

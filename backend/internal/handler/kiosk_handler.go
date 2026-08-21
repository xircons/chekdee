package handler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type KioskHandler struct {
	devices    *usecase.KioskDeviceUsecase
	attendance *usecase.AttendanceUsecase
	roster     *usecase.KioskRosterUsecase
}

func NewKioskHandler(devices *usecase.KioskDeviceUsecase, attendance *usecase.AttendanceUsecase, roster *usecase.KioskRosterUsecase) *KioskHandler {
	return &KioskHandler{devices: devices, attendance: attendance, roster: roster}
}

type kioskDeviceView struct {
	ID          string  `json:"id"`
	DeviceID    string  `json:"device_id"`
	Name        string  `json:"name"`
	MaskedToken string  `json:"masked_token"`
	CreatedBy   *string `json:"created_by"`
	CreatedAt   string  `json:"created_at"`
	RevokedAt   *string `json:"revoked_at"`
}

// maskToken shows only the last 4 characters — kiosk device tokens are
// never rendered in full except once, right after creation or rotation.
func maskToken(hash string) string {
	if len(hash) <= 4 {
		return "••••" + hash
	}
	return "••••••••" + hash[len(hash)-4:]
}

func toKioskDeviceView(d *domain.KioskDevice) kioskDeviceView {
	v := kioskDeviceView{
		ID:          d.ID,
		DeviceID:    d.DeviceID,
		Name:        d.Name,
		MaskedToken: maskToken(d.TokenHash),
		CreatedBy:   d.CreatedBy,
		CreatedAt:   d.CreatedAt.Format(time.RFC3339),
	}
	if d.RevokedAt != nil {
		s := d.RevokedAt.Format(time.RFC3339)
		v.RevokedAt = &s
	}
	return v
}

type kioskDeviceWithTokenView struct {
	kioskDeviceView
	Token string `json:"token"`
}

type createKioskDeviceRequest struct {
	Name string `json:"name"`
}

// Create mints a new kiosk device and returns its token in full — the only
// two times that ever happens (here and Rotate). Mounted behind RequireRole.
func (h *KioskHandler) Create(c echo.Context) error {
	var req createKioskDeviceRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุชื่อ")
	}

	device, rawToken, err := h.devices.Create(c.Request().Context(), req.Name, userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "สร้างอุปกรณ์ไม่สำเร็จ")
	}
	return c.JSON(http.StatusCreated, kioskDeviceWithTokenView{toKioskDeviceView(device), rawToken})
}

// Rotate issues a new token for an existing device, invalidating the old
// one immediately. Mounted behind RequireRole.
func (h *KioskHandler) Rotate(c echo.Context) error {
	device, rawToken, err := h.devices.Rotate(c.Request().Context(), c.Param("deviceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบอุปกรณ์")
	}
	return c.JSON(http.StatusOK, kioskDeviceWithTokenView{toKioskDeviceView(device), rawToken})
}

// Revoke kills a device's live session immediately and permanently. Mounted
// behind RequireRole.
func (h *KioskHandler) Revoke(c echo.Context) error {
	if err := h.devices.Revoke(c.Request().Context(), c.Param("deviceId")); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบอุปกรณ์")
	}
	return c.NoContent(http.StatusNoContent)
}

// List returns the latest row per device (active or revoked), tokens
// masked. Mounted behind RequireRole.
func (h *KioskHandler) List(c echo.Context) error {
	devices, err := h.devices.ListAll(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดรายการอุปกรณ์ไม่สำเร็จ")
	}
	out := make([]kioskDeviceView, 0, len(devices))
	for _, d := range devices {
		out = append(out, toKioskDeviceView(d))
	}
	return c.JSON(http.StatusOK, out)
}

type qrTokenView struct {
	Token      string `json:"token"`
	ExpiresAt  string `json:"expires_at"`
	DeviceName string `json:"device_name"`
}

// QRToken mints the next rotating QR payload for this screen. Mounted
// behind RequireKioskDevice — device-token authenticated, not a user JWT.
func (h *KioskHandler) QRToken(c echo.Context) error {
	token, expiresAt, err := h.attendance.MintQRToken(c.Request().Context(), deviceIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "สร้าง QR code ไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, qrTokenView{
		Token:      token,
		ExpiresAt:  expiresAt.Format("2006-01-02T15:04:05Z07:00"),
		DeviceName: deviceNameFromContext(c),
	})
}

type kioskRosterStatsView struct {
	TotalActive int `json:"total_active"`
	CheckedIn   int `json:"checked_in"`
	Late        int `json:"late"`
	Absent      int `json:"absent"`
	OnLeave     int `json:"on_leave"`
}

// RosterStats returns today's org-wide counts, aggregate only -- no
// employee names/ids/per-person status. Mounted behind RequireKioskDevice,
// same as QRToken above: the lobby TV is a public display, so it gets a
// narrower endpoint than the admin-only GET /reports/daily-log, not a
// loosened version of that one.
func (h *KioskHandler) RosterStats(c echo.Context) error {
	stats, err := h.roster.Stats(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดข้อมูลสรุปไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, kioskRosterStatsView{
		TotalActive: stats.TotalActive,
		CheckedIn:   stats.CheckedIn,
		Late:        stats.Late,
		Absent:      stats.Absent,
		OnLeave:     stats.OnLeave,
	})
}

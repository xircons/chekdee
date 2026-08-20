package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type KioskHandler struct {
	devices    *usecase.KioskDeviceUsecase
	attendance *usecase.AttendanceUsecase
}

func NewKioskHandler(devices *usecase.KioskDeviceUsecase, attendance *usecase.AttendanceUsecase) *KioskHandler {
	return &KioskHandler{devices: devices, attendance: attendance}
}

type kioskDeviceView struct {
	ID          string  `json:"id"`
	DeviceID    string  `json:"device_id"`
	Name        string  `json:"name"`
	MaskedToken string  `json:"masked_token"`
	CreatedBy   *string `json:"created_by"`
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
	return kioskDeviceView{
		ID:          d.ID,
		DeviceID:    d.DeviceID,
		Name:        d.Name,
		MaskedToken: maskToken(d.TokenHash),
		CreatedBy:   d.CreatedBy,
	}
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
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	device, rawToken, err := h.devices.Create(c.Request().Context(), req.Name, userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create device")
	}
	return c.JSON(http.StatusCreated, kioskDeviceWithTokenView{toKioskDeviceView(device), rawToken})
}

// Rotate issues a new token for an existing device, invalidating the old
// one immediately. Mounted behind RequireRole.
func (h *KioskHandler) Rotate(c echo.Context) error {
	device, rawToken, err := h.devices.Rotate(c.Request().Context(), c.Param("deviceId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "device not found")
	}
	return c.JSON(http.StatusOK, kioskDeviceWithTokenView{toKioskDeviceView(device), rawToken})
}

// Revoke kills a device's live session immediately and permanently. Mounted
// behind RequireRole.
func (h *KioskHandler) Revoke(c echo.Context) error {
	if err := h.devices.Revoke(c.Request().Context(), c.Param("deviceId")); err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "device not found")
	}
	return c.NoContent(http.StatusNoContent)
}

// List returns every active device, tokens masked. Mounted behind RequireRole.
func (h *KioskHandler) List(c echo.Context) error {
	devices, err := h.devices.ListActive(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to list devices")
	}
	out := make([]kioskDeviceView, 0, len(devices))
	for _, d := range devices {
		out = append(out, toKioskDeviceView(d))
	}
	return c.JSON(http.StatusOK, out)
}

type qrTokenView struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
}

// QRToken mints the next rotating QR payload for this screen. Mounted
// behind RequireKioskDevice — device-token authenticated, not a user JWT.
func (h *KioskHandler) QRToken(c echo.Context) error {
	token, expiresAt, err := h.attendance.MintQRToken(c.Request().Context(), deviceIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to mint qr token")
	}
	return c.JSON(http.StatusOK, qrTokenView{Token: token, ExpiresAt: expiresAt.Format("2006-01-02T15:04:05Z07:00")})
}

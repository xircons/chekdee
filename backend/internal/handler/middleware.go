package handler

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

const (
	ctxUserIDKey     = "user_id"
	ctxRoleKey       = "role"
	ctxDeviceIDKey   = "device_id"
	ctxDeviceNameKey = "device_name"
)

// RequireAuth parses the Authorization: Bearer <token> header and stashes
// the user id/role on the Echo context for downstream handlers.
func RequireAuth(jwt *usecase.JWTIssuer) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing bearer token")
			}

			userID, role, err := jwt.ParseAccessToken(strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}

			c.Set(ctxUserIDKey, userID)
			c.Set(ctxRoleKey, role)
			return next(c)
		}
	}
}

// RequireRole must run after RequireAuth.
func RequireRole(roles ...domain.Role) echo.MiddlewareFunc {
	allowed := make(map[domain.Role]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			role, _ := c.Get(ctxRoleKey).(domain.Role)
			if _, ok := allowed[role]; !ok {
				return echo.NewHTTPError(http.StatusForbidden, "insufficient role")
			}
			return next(c)
		}
	}
}

func userIDFromContext(c echo.Context) string {
	id, _ := c.Get(ctxUserIDKey).(string)
	return id
}

func roleFromContext(c echo.Context) domain.Role {
	role, _ := c.Get(ctxRoleKey).(domain.Role)
	return role
}

// RequireKioskDevice authenticates a kiosk route via the device's long-lived
// link token (query param, matching the frontend's existing
// `/kiosk/lobby-tv?token=` convention) — not a user JWT. Distinct from
// RequireAuth: kiosks have no user session.
func RequireKioskDevice(devices *usecase.KioskDeviceUsecase) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := c.QueryParam("token")
			if token == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing device token")
			}

			device, err := devices.VerifyToken(c.Request().Context(), token)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or revoked device token")
			}

			c.Set(ctxDeviceIDKey, device.DeviceID)
			c.Set(ctxDeviceNameKey, device.Name)
			return next(c)
		}
	}
}

func deviceIDFromContext(c echo.Context) string {
	id, _ := c.Get(ctxDeviceIDKey).(string)
	return id
}

func deviceNameFromContext(c echo.Context) string {
	name, _ := c.Get(ctxDeviceNameKey).(string)
	return name
}

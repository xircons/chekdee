// Package handler wires HTTP routes to usecases. It depends on usecase,
// never on repository directly.
package handler

import (
	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/usecase"
)

func RegisterRoutes(e *echo.Echo, auth *AuthHandler, jwtIssuer *usecase.JWTIssuer) {
	e.GET("/healthz", HealthCheck)

	e.POST("/auth/line/login", auth.LineLogin)
	e.POST("/auth/refresh", auth.Refresh)
	e.POST("/auth/logout", auth.Logout)

	// Attached directly (not via an empty-prefix e.Group) — an empty
	// group prefix was found to leak RequireAuth onto unrelated/unmatched
	// routes under Echo's router.
	e.POST("/auth/register", auth.CompleteRegistration, RequireAuth(jwtIssuer))
	e.GET("/auth/me", auth.Me, RequireAuth(jwtIssuer))
}

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

	protected := e.Group("")
	protected.Use(RequireAuth(jwtIssuer))
	protected.POST("/auth/register", auth.CompleteRegistration)
}

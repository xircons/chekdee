// Package handler wires HTTP routes to usecases. It depends on usecase,
// never on repository directly.
package handler

import "github.com/labstack/echo/v4"

func RegisterRoutes(e *echo.Echo) {
	e.GET("/healthz", HealthCheck)
}

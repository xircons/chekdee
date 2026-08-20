// Package handler wires HTTP routes to usecases. It depends on usecase,
// never on repository directly.
package handler

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"

	"checkdee-backend/internal/usecase"
)

func RegisterRoutes(e *echo.Echo, auth *AuthHandler, jwtIssuer *usecase.JWTIssuer) {
	e.GET("/healthz", HealthCheck)

	// Per-IP throttles on the credential-accepting endpoints. Password login
	// guards the all-powerful system_owner account, so it is the tightest;
	// the LINE code-exchange endpoints get a looser cap. Applied per-route so
	// unauthenticated reads (/healthz) and bearer-authenticated routes are
	// unaffected.
	loginLimiter := rateLimiter(rate.Limit(0.2), 5) // ~12/min sustained, burst 5
	lineLimiter := rateLimiter(rate.Limit(1), 10)   // ~60/min sustained, burst 10

	e.GET("/auth/line/authorize", auth.LineAuthorize, lineLimiter)
	e.POST("/auth/line/login", auth.LineLogin, lineLimiter)
	e.POST("/auth/login", auth.PasswordLogin, loginLimiter)
	e.POST("/auth/refresh", auth.Refresh, lineLimiter)
	e.POST("/auth/logout", auth.Logout)

	// Attached directly (not via an empty-prefix e.Group) — an empty
	// group prefix was found to leak RequireAuth onto unrelated/unmatched
	// routes under Echo's router.
	e.POST("/auth/register", auth.CompleteRegistration, RequireAuth(jwtIssuer))
	e.GET("/auth/me", auth.Me, RequireAuth(jwtIssuer))
}

// rateLimiter builds an in-memory per-IP limiter. Each source IP gets its own
// token bucket at the given sustained rate and burst; over-limit requests get
// 429. In-memory is fine for a single instance — a shared store is a later
// concern if the API is horizontally scaled.
func rateLimiter(r rate.Limit, burst int) echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:  r,
			Burst: burst,
		}),
	})
}

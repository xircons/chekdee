// Package handler wires HTTP routes to usecases. It depends on usecase,
// never on repository directly.
package handler

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

// adminRoles gates the admin-mutating schedule/holiday routes — the same
// trio the frontend's /admin/leave-requests already treats as equivalent
// (the sidebar doesn't yet vary by role; that's a later Phase 4 concern).
var adminRoles = []domain.Role{domain.RoleAdmin, domain.RoleSupervisor, domain.RoleSystemOwner}

func RegisterRoutes(
	e *echo.Echo,
	auth *AuthHandler,
	schedules *ScheduleHandler,
	holidays *HolidayHandler,
	kiosk *KioskHandler,
	attendance *AttendanceHandler,
	reports *ReportHandler,
	leaves *LeaveHandler,
	notifications *NotificationHandler,
	employees *EmployeeHandler,
	jwtIssuer *usecase.JWTIssuer,
	deviceAuth *usecase.KioskDeviceUsecase,
) {
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

	e.GET("/schedules/me", schedules.Me, RequireAuth(jwtIssuer))
	e.GET("/schedules/:employeeId", schedules.ListForEmployee, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.PUT("/schedules/:employeeId", schedules.Replace, RequireAuth(jwtIssuer), RequireRole(adminRoles...))

	// Holidays are readable by any authenticated user (employees need them
	// on their own calendar view); only admin/supervisor/system_owner can
	// mutate the calendar.
	e.GET("/holidays", holidays.List, RequireAuth(jwtIssuer))
	e.POST("/holidays", holidays.Create, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.PUT("/holidays/:id", holidays.Update, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.DELETE("/holidays/:id", holidays.Delete, RequireAuth(jwtIssuer), RequireRole(adminRoles...))

	// Kiosk device management is admin-only; there is no other PR in the
	// backend work breakdown for it, and attendance check-in needs a way to
	// create/verify device tokens, so it's bundled into this PR.
	e.GET("/kiosk/devices", kiosk.List, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.POST("/kiosk/devices", kiosk.Create, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.POST("/kiosk/devices/:deviceId/rotate", kiosk.Rotate, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.POST("/kiosk/devices/:deviceId/revoke", kiosk.Revoke, RequireAuth(jwtIssuer), RequireRole(adminRoles...))

	// Device-token authenticated (not a user JWT) — the kiosk TV polls this
	// every ~15s to rotate its displayed QR.
	e.GET("/kiosk/qr-token", kiosk.QRToken, RequireKioskDevice(deviceAuth))
	// Also device-token authenticated -- aggregate-only counts for the
	// public lobby display, deliberately narrower than the admin-only
	// GET /reports/daily-log (see RosterStats' doc comment).
	e.GET("/kiosk/roster-stats", kiosk.RosterStats, RequireKioskDevice(deviceAuth))

	e.POST("/attendance/check-in", attendance.CheckIn, RequireAuth(jwtIssuer))
	e.POST("/attendance/check-out", attendance.CheckOut, RequireAuth(jwtIssuer))
	e.GET("/attendance/me/today", attendance.Today, RequireAuth(jwtIssuer))

	e.GET("/reports/monthly", reports.Monthly, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.GET("/reports/daily-log", reports.DailyLog, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.POST("/reports/export", reports.RequestExport, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.GET("/reports/export/:id", reports.GetExport, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.GET("/reports/export/:id/download", reports.DownloadExport, RequireAuth(jwtIssuer), RequireRole(adminRoles...))

	e.POST("/leave-requests", leaves.Create, RequireAuth(jwtIssuer))
	e.GET("/leave-requests/me", leaves.Me, RequireAuth(jwtIssuer))
	e.GET("/leave-requests", leaves.List, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.POST("/leave-requests/:id/approve", leaves.Approve, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.POST("/leave-requests/:id/reject", leaves.Reject, RequireAuth(jwtIssuer), RequireRole(adminRoles...))

	e.GET("/notifications/me", notifications.Me, RequireAuth(jwtIssuer))
	e.POST("/notifications/:id/read", notifications.MarkRead, RequireAuth(jwtIssuer))

	// Employee directory is admin-only, same trio as schedules/holidays
	// mutations — see adminRoles above.
	e.GET("/employees", employees.List, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.GET("/employees/:id", employees.Get, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.PATCH("/employees/:id", employees.Update, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.PATCH("/employees/:id/role", employees.UpdateRole, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
	e.POST("/employees/:id/offboard", employees.Offboard, RequireAuth(jwtIssuer), RequireRole(adminRoles...))
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

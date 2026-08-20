// Package server assembles the Echo instance and owns its lifecycle.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/riverqueue/river"

	"checkdee-backend/internal/config"
	"checkdee-backend/internal/handler"
	"checkdee-backend/internal/usecase"
)

type Server struct {
	echo        *echo.Echo
	cfg         *config.Config
	logger      *slog.Logger
	riverClient *river.Client[pgx.Tx]
}

func New(
	cfg *config.Config,
	logger *slog.Logger,
	authHandler *handler.AuthHandler,
	scheduleHandler *handler.ScheduleHandler,
	holidayHandler *handler.HolidayHandler,
	kioskHandler *handler.KioskHandler,
	attendanceHandler *handler.AttendanceHandler,
	reportHandler *handler.ReportHandler,
	leaveHandler *handler.LeaveHandler,
	jwtIssuer *usecase.JWTIssuer,
	kioskDeviceUsecase *usecase.KioskDeviceUsecase,
	riverClient *river.Client[pgx.Tx],
) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(middleware.Secure()) // X-Frame-Options, X-Content-Type-Options, etc.
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		// Explicit allow-list, not a wildcard: credentials (the refresh
		// cookie) are only released to these origins.
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	handler.RegisterRoutes(e, authHandler, scheduleHandler, holidayHandler, kioskHandler, attendanceHandler, reportHandler, leaveHandler, jwtIssuer, kioskDeviceUsecase)

	return &Server{echo: e, cfg: cfg, logger: logger, riverClient: riverClient}
}

// Start runs the river client (holiday sync and any later jobs) and the HTTP
// server. There is no separate worker process in this repo, so both run
// embedded in one process — see jobs.NewClient's doc comment.
//
// Neither has a graceful-shutdown path yet (pre-existing gap for HTTP,
// newly relevant now that river is embedded): both die with the process on
// SIGTERM rather than draining in-flight work first. river re-attempts jobs
// left running when a client dies mid-job, so this is not a correctness
// issue, just a rougher-than-ideal shutdown — worth a follow-up if job
// volume or request latency ever makes it matter.
func (s *Server) Start() error {
	if err := s.riverClient.Start(context.Background()); err != nil {
		return err
	}

	s.logger.Info("starting server", "port", s.cfg.Port, "env", s.cfg.Env)

	httpServer := &http.Server{
		Addr:         ":" + s.cfg.Port,
		Handler:      s.echo,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	return s.echo.StartServer(httpServer)
}

// Package server assembles the Echo instance and owns its lifecycle.
package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"checkdee-backend/internal/config"
	"checkdee-backend/internal/handler"
	"checkdee-backend/internal/usecase"
)

type Server struct {
	echo   *echo.Echo
	cfg    *config.Config
	logger *slog.Logger
}

func New(cfg *config.Config, logger *slog.Logger, authHandler *handler.AuthHandler, jwtIssuer *usecase.JWTIssuer) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())

	handler.RegisterRoutes(e, authHandler, jwtIssuer)

	return &Server{echo: e, cfg: cfg, logger: logger}
}

func (s *Server) Start() error {
	s.logger.Info("starting server", "port", s.cfg.Port, "env", s.cfg.Env)

	httpServer := &http.Server{
		Addr:         ":" + s.cfg.Port,
		Handler:      s.echo,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	return s.echo.StartServer(httpServer)
}

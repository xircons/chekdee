//go:build wireinject

// Package wire declares the compile-time dependency graph. Run `make wire`
// (requires github.com/google/wire/cmd/wire) after changing this file to
// regenerate wire_gen.go.
package wire

import (
	"log/slog"

	"github.com/google/wire"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/config"
	"checkdee-backend/internal/db"
	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/handler"
	"checkdee-backend/internal/lineclient"
	"checkdee-backend/internal/repository"
	"checkdee-backend/internal/server"
	"checkdee-backend/internal/usecase"
)

func provideDB(cfg *config.Config) (*pgxpool.Pool, error) {
	return db.Connect(cfg.DatabaseURL)
}

func provideLineClient(cfg *config.Config) *lineclient.Client {
	return lineclient.New(cfg.LineChannelID, cfg.LineChannelSecret)
}

func provideJWTIssuer(cfg *config.Config) *usecase.JWTIssuer {
	return usecase.NewJWTIssuer(cfg.JWTSecret)
}

func InitializeServer(logger *slog.Logger) (*server.Server, error) {
	wire.Build(
		config.Load,
		provideDB,
		provideLineClient,
		provideJWTIssuer,
		repository.NewUserRepository,
		repository.NewRefreshTokenRepository,
		wire.Bind(new(domain.UserRepository), new(*repository.UserRepository)),
		wire.Bind(new(domain.RefreshTokenRepository), new(*repository.RefreshTokenRepository)),
		wire.Bind(new(usecase.LineClient), new(*lineclient.Client)),
		usecase.NewAuthUsecase,
		handler.NewAuthHandler,
		server.New,
	)
	return nil, nil
}

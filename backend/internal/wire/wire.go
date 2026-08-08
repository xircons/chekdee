//go:build wireinject

// Package wire declares the compile-time dependency graph. Run `make wire`
// (requires github.com/google/wire/cmd/wire) after changing this file to
// regenerate wire_gen.go.
package wire

import (
	"log/slog"

	"github.com/google/wire"

	"checkdee-backend/internal/config"
	"checkdee-backend/internal/server"
)

func InitializeServer(logger *slog.Logger) (*server.Server, error) {
	wire.Build(
		config.Load,
		server.New,
	)
	return nil, nil
}

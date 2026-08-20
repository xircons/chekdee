package main

import (
	"log/slog"
	"os"

	"checkdee-backend/internal/wire"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	srv, err := wire.InitializeServer(logger)
	if err != nil {
		logger.Error("failed to initialize server", "error", err)
		os.Exit(1)
	}

	if err := srv.Start(); err != nil {
		logger.Error("server exited with error", "error", err)
		os.Exit(1)
	}
}

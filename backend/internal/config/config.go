// Package config loads runtime configuration from the environment.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port        string
	Env         string
	DatabaseURL string
	JWTSecret   string

	LineChannelID     string
	LineChannelSecret string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		Env:               getEnv("APP_ENV", "development"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		JWTSecret:         os.Getenv("JWT_SECRET"),
		LineChannelID:     os.Getenv("LINE_CHANNEL_ID"),
		LineChannelSecret: os.Getenv("LINE_CHANNEL_SECRET"),
	}

	required := map[string]string{
		"DATABASE_URL":        cfg.DatabaseURL,
		"JWT_SECRET":          cfg.JWTSecret,
		"LINE_CHANNEL_ID":     cfg.LineChannelID,
		"LINE_CHANNEL_SECRET": cfg.LineChannelSecret,
	}
	for name, value := range required {
		if value == "" {
			return nil, fmt.Errorf("%s is required", name)
		}
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

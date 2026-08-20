// Package config loads runtime configuration from the environment.
package config

import (
	"fmt"
	"os"
	"strings"
)

// minJWTSecretBytes is the floor for an HS256 signing key. A short secret is
// brute-forceable offline, so a weak one fails fast at boot rather than
// silently shipping a forgeable token.
const minJWTSecretBytes = 32

// minQRSigningSecretBytes: same reasoning as the JWT secret — this signs
// the QR payload presence-proof, so a weak key defeats it offline.
const minQRSigningSecretBytes = 32

type Config struct {
	Port        string
	Env         string
	DatabaseURL string
	// AppDatabaseURL is the connection the running server uses for its own
	// pool. It is a distinct, least-privilege role (checkdee_app, created in
	// migration 000005) from DatabaseURL, which stays the owner/superuser
	// connection used by golang-migrate, seedowner, and integration tests —
	// none of those should run as the restricted app role.
	AppDatabaseURL string
	JWTSecret      string
	// QRSigningSecret signs the kiosk's rotating QR payload — a distinct
	// secret from JWTSecret and from a kiosk device's own long-lived link
	// token (kiosk_devices), per the QR/kiosk model note in PLAN.md.
	QRSigningSecret string

	LineChannelID     string
	LineChannelSecret string

	// AllowedOrigins is the CORS allow-list for browser clients; credentials
	// (the refresh cookie) are only sent to these exact origins.
	AllowedOrigins []string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		Env:               getEnv("APP_ENV", "development"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		AppDatabaseURL:    os.Getenv("APP_DATABASE_URL"),
		JWTSecret:         os.Getenv("JWT_SECRET"),
		QRSigningSecret:   os.Getenv("QR_SIGNING_SECRET"),
		LineChannelID:     os.Getenv("LINE_CHANNEL_ID"),
		LineChannelSecret: os.Getenv("LINE_CHANNEL_SECRET"),
		AllowedOrigins:    splitAndTrim(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
	}

	required := map[string]string{
		"DATABASE_URL":        cfg.DatabaseURL,
		"APP_DATABASE_URL":    cfg.AppDatabaseURL,
		"JWT_SECRET":          cfg.JWTSecret,
		"QR_SIGNING_SECRET":   cfg.QRSigningSecret,
		"LINE_CHANNEL_ID":     cfg.LineChannelID,
		"LINE_CHANNEL_SECRET": cfg.LineChannelSecret,
	}
	for name, value := range required {
		if value == "" {
			return nil, fmt.Errorf("%s is required", name)
		}
	}

	if len(cfg.JWTSecret) < minJWTSecretBytes {
		return nil, fmt.Errorf("JWT_SECRET must be at least %d bytes, got %d", minJWTSecretBytes, len(cfg.JWTSecret))
	}
	if len(cfg.QRSigningSecret) < minQRSigningSecretBytes {
		return nil, fmt.Errorf("QR_SIGNING_SECRET must be at least %d bytes, got %d", minQRSigningSecretBytes, len(cfg.QRSigningSecret))
	}
	if len(cfg.AllowedOrigins) == 0 {
		return nil, fmt.Errorf("CORS_ALLOWED_ORIGINS must list at least one origin")
	}

	return cfg, nil
}

func splitAndTrim(csv string) []string {
	parts := strings.Split(csv, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

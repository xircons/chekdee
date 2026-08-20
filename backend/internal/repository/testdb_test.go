package repository_test

import (
	"os"
	"testing"
)

// requireDB returns DATABASE_URL for the repository integration tests. When
// it is unset the behaviour depends on the environment: in CI (CI is set by
// GitHub Actions and most runners) a missing database is a hard failure so
// these tests can never silently pass by skipping; locally it is a skip so a
// developer without Postgres can still run the rest of the suite.
func requireDB(t *testing.T) string {
	t.Helper()
	if url := os.Getenv("DATABASE_URL"); url != "" {
		return url
	}
	if os.Getenv("CI") != "" {
		t.Fatal("DATABASE_URL must be set in CI: repository tests require a real Postgres")
	}
	t.Skip("DATABASE_URL not set; skipping integration test")
	return ""
}

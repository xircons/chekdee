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

// requireAppDB returns APP_DATABASE_URL — a connection as the restricted
// checkdee_app role (migration 000005), not the owner role requireDB
// returns. Same fail-in-CI/skip-locally behaviour: a dev who hasn't set up
// the role locally can still run the rest of the suite, but CI can't
// silently skip the one test that proves the role's privilege boundary.
func requireAppDB(t *testing.T) string {
	t.Helper()
	if url := os.Getenv("APP_DATABASE_URL"); url != "" {
		return url
	}
	if os.Getenv("CI") != "" {
		t.Fatal("APP_DATABASE_URL must be set in CI: the checkdee_app privilege test requires it")
	}
	t.Skip("APP_DATABASE_URL not set; skipping checkdee_app privilege test")
	return ""
}

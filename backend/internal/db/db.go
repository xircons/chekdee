// Package db owns the Postgres connection pool.
package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	return pgxpool.New(context.Background(), databaseURL)
}

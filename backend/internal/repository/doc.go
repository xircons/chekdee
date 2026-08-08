// Package repository implements the domain layer's repository interfaces
// against Postgres (sqlc + pgx). It depends on domain; usecase and handler
// must not import it directly — they depend on the domain interfaces.
package repository

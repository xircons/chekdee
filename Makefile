.PHONY: dev deps backend-dev frontend-dev migrate-up migrate-down sqlc wire oapi river-migrate test

dev:
	docker compose up --build

deps:
	cd backend && go mod tidy && go mod tidy -tags wireinject

backend-dev:
	cd backend && go run ./cmd/server

frontend-dev:
	cd frontend && npm run dev

migrate-up:
	migrate -path backend/db/migrations -database "$$DATABASE_URL" up

migrate-down:
	migrate -path backend/db/migrations -database "$$DATABASE_URL" down 1

# Code generation runs through pinned `tool` dependencies in backend/go.mod,
# so these need no globally-installed binaries — only the Go toolchain.
sqlc:
	cd backend && go tool sqlc generate

wire:
	cd backend && go tool wire ./internal/wire

oapi:
	cd backend && go tool oapi-codegen -config oapi-codegen.yaml ../openapi/openapi.yaml

# Creates/updates river's own queue tables. Kept out of the golang-migrate
# sequence so river owns its schema; run once against a fresh database.
river-migrate:
	cd backend && go tool river migrate-up --database-url "$$DATABASE_URL"

test:
	cd backend && go test ./...

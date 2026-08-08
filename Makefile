.PHONY: dev deps backend-dev frontend-dev migrate-up migrate-down sqlc wire test

dev:
	docker compose up --build

deps:
	cd backend && go mod tidy

backend-dev:
	cd backend && go run ./cmd/server

frontend-dev:
	cd frontend && npm run dev

migrate-up:
	migrate -path backend/db/migrations -database "$$DATABASE_URL" up

migrate-down:
	migrate -path backend/db/migrations -database "$$DATABASE_URL" down 1

sqlc:
	cd backend && sqlc generate

wire:
	cd backend/internal/wire && wire

test:
	cd backend && go test ./...

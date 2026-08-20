# Chekdee

Chekdee (from the Thai "เช็คดี") is a LINE OA-based employee attendance app for
CAMT, Chiang Mai University, with an admin panel for reporting.

Styling conventions live in `design.md` and contribution/branching rules live in
`CONTRIBUTING.md` (both local-only, not tracked in this repo — ask a maintainer
for a copy if you don't have one).

## Stack

- **Backend** (`backend/`): Go + Echo, layered `handler → usecase → repository/domain`,
  sqlc + pgx, golang-migrate, google/wire, slog, JWT auth.
- **Frontend** (`frontend/`): Next.js (App Router) + TypeScript + Tailwind + shadcn/ui,
  react-hook-form + zod.
- **API contract**: `openapi/openapi.yaml` — shared source of truth for the backend
  handlers and the generated frontend client.
- **Database**: PostgreSQL via Docker Compose in development.

## Getting started

Prerequisites: Go 1.23+, Node 22+, Docker.

```bash
# copy env templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# fetch backend deps (Go isn't bundled in every dev environment — run this once)
make deps

# run everything (postgres + backend + frontend)
make dev
```

Or run services individually during development:

```bash
make backend-dev   # go run ./cmd/server
make frontend-dev  # npm run dev
```

Backend health check: `GET http://localhost:8080/healthz`
Frontend: `http://localhost:3000`

## Database migrations

```bash
export DATABASE_URL=postgres://checkdee:checkdee@localhost:5432/checkdee?sslmode=disable
make migrate-up
make migrate-down
```

## Branching

See `CONTRIBUTING.md`. Short version: branch off `dev` as `feature/<short-description>`,
PR into `dev`, release `main` by merging `dev` in at release points.

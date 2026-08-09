# Checkdee — Execution Plan

**Current focus:** Phase 1 — frontend scaffold: layout shells (bottom tab nav / admin
sidebar) and the mock/stub data layer.

This is a living document. Update it in place as phases and tasks complete — don't
recreate it, don't leave stale status.

## Why this plan exists

Execution order changed from the original project prompt / day-1 handoff: backend work
is paused (the `feature/db-schema` PR into `dev` stays open, untouched, awaiting review)
in favor of building out the Next.js frontend first against mock/stub data, using
`design.md` as the styling source of truth. The Go backend gets wired up later — frontend
UI work should not block on it. See the original project prompt for full product spec;
re-read it at Phase 4.

## Phase 1 — Frontend scaffold

Status: **in progress**

- [x] Next.js + Tailwind + shadcn/ui project in place (already scaffolded on `dev`).
- [x] Color, typography, spacing, and radius tokens from `design.md` are wired up —
      Tailwind v4 uses CSS-based theming (`@theme` in `globals.css`), not a JS
      `tailwind.config`, so this is done there rather than in a config file.
- [ ] Layout shell: bottom tab navigation (Home, Leave, Schedule, Profile) for the
      employee mobile view.
- [ ] Layout shell: left sidebar navigation for the admin panel (desktop-first), per the
      layout patterns section of `design.md`.
- [ ] Mock/stub data layer (fixtures + a mock API module) standing in for the backend,
      structured to match the DB schema already designed on `feature/db-schema`
      (`users`/`teams`, `work_schedules`, `holidays`, `attendance_records`,
      `leave_requests`).

## Phase 2 — Employee views (mobile-first)

Status: **not started**

- [ ] Home/dashboard: status card, 2-column stat grid (hours this month, late count,
      absence count, leave balance) — refactor the current ad hoc version in `page.tsx`
      into the real layout shell.
- [ ] Check-in/out screen — UI only for now; geofence/WiFi logic is backend work, stub
      the interaction.
- [ ] Leave request form — react-hook-form + zod, validated against the leave fields
      (date range, reason) matching `leave_requests`.
- [ ] My requests list — pending/approved/rejected, mock data for now.
- [ ] Schedule/calendar view.
- [ ] Profile view.

## Phase 3 — Admin/HR views (desktop-first)

Status: **not started**

- [ ] Dashboard: present today, pending approvals, absences, leave requests — matching
      the card style from the design reference.
- [ ] Employee directory: create, edit, offboard (soft-delete UI — never a hard delete).
- [ ] Schedule management: per-employee recurring weekly schedule editor.
- [ ] Holidays / company calendar: manually add, edit, remove.
- [ ] Import/export UI, CSV bulk import UI for schedules.
- [ ] Supervisor view: leave request approval list (in-app fallback view — supervisors
      also approve via the email-approval link).

## Phase 4 — Backend integration

Status: **not started**

- [ ] Go backend: check-in/out, leave email-approval flow, notifications, and the rest
      of the original spec — re-read the original project prompt at this point.
- [ ] Replace mock/stub data in the frontend with real API calls once the Go backend is
      ready.

## Conventions

- Only the four now-allowed root files (`README.md`, `design.md`, `CONTRIBUTING.md`,
  `PLAN.md`). Minimal code comments.
- All PRs target `dev`, never `main`.
- Use the exact tokens from `design.md` — no new colors or hardcoded hex values.
- Branching for this push: `frontend-<short-description>` off `dev`, same PR-into-`dev`
  workflow as before.

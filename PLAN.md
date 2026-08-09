# Checkdee — Execution Plan

**Current focus:** Phase 2, in progress — dashboard, check-in/out, leave, and schedule
are done; next up is the profile view (the last Phase 2 item).

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

Status: **done**

- [x] Next.js + Tailwind + shadcn/ui project in place (already scaffolded on `dev`).
- [x] Color, typography, spacing, and radius tokens from `design.md` are wired up —
      Tailwind v4 uses CSS-based theming (`@theme` in `globals.css`), not a JS
      `tailwind.config`, so this is done there rather than in a config file.
- [x] Layout shell: bottom tab navigation (Home, Leave, Schedule, Profile) for the
      employee mobile view — `(employee)/layout.tsx` + `components/employee-nav.tsx`,
      routes `/`, `/leave`, `/schedule`, `/profile` (Leave/Schedule are placeholder
      pages until Phase 2).
- [x] Layout shell: left sidebar navigation for the admin panel (desktop-first), per the
      layout patterns section of `design.md` — `admin/layout.tsx` +
      `components/admin-sidebar.tsx`, routes `/admin`, `/admin/employees`,
      `/admin/schedules`, `/admin/holidays`, `/admin/leave-requests` (all placeholder
      pages until Phase 3).
- [x] Role-based landing: `/auth/me`'s `role` routes employees to the tab-nav shell and
      admin/supervisor/system_owner to the sidebar shell, each redirecting away from the
      other's routes.
- [x] Mock/stub data layer (fixtures + typed accessors) standing in for the backend,
      structured to match the DB schema already designed on `feature/db-schema`
      (`users`/`teams`, `work_schedules`, `holidays`, `attendance_records`,
      `leave_requests`) — `src/lib/mock-data.ts`. Not yet consumed by any page; that
      starts in Phase 2.

## Phase 2 — Employee views (mobile-first)

Status: **in progress**

- [x] Home/dashboard: status card (today's check-in/out state), 2-column stat grid
      (hours this month, late count, absence count, leave balance) — now wired to
      `mock-data.ts` accessors (`getMonthlyAttendanceStats`, `getLeaveBalance`) keyed to
      the logged-in employee's id.
- [x] Check-in/out screen — `(employee)/check-in/page.tsx`. UI only, as planned:
      geofence/WiFi verification is a Phase 4 backend concern. Today's check-in/out
      state lives in an in-memory `AttendanceProvider`
      (`src/lib/attendance-store.tsx`), scoped to the employee layout, resets on
      reload — there's no real persistence until Phase 4.
- [x] Leave request form — react-hook-form + zod, validated against the leave fields
      (date range, reason) matching `leave_requests`, including the
      `end_date >= start_date` DB constraint. Built into the same `/leave` page as the
      requests list below (design.md's nav has one "Leave" tab, not a separate route per
      concern).
- [x] My requests list — pending/approved/rejected, mock data for now. Newly submitted
      requests are held in local page state (session-only, not persisted) and prepended
      to the mock list.
- [x] Schedule/calendar view — weekly recurring schedule (from `work_schedules`, via
      `getWorkScheduleForEmployee`) with today highlighted, plus an upcoming-holidays
      list (`getUpcomingHolidays`).
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

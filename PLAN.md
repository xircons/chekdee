# Chekdee — Execution Plan

This is a living document, now tracked in git (previously gitignored and
local-only, which is why it went stale — see "Why this file is now tracked"
below). Update it in place, in the same PR, as each item below completes.
Don't recreate it, don't leave stale status.

## Why this file is now tracked

`PLAN.md` used to be gitignored. That meant it only ever reflected whatever
one contributor's local checkout believed at the time, with no way for
anyone else (or a future session) to see it drift out of sync with the real
repo — which it did badly (the previous version of this file claimed "Phase
4 (backend integration) not yet started" when in fact the entire backend was
already merged into `dev`). Removed the `PLAN.md` line from `.gitignore` so
this file is now a real, reviewable part of the repo and can't silently
diverge from what actually merged.

## Verified status as of 2026-08-21

Everything in this section was confirmed directly against the repo — `git
log`/`git branch -a`/`gh pr list`, `git grep` for `from "@/lib/mock-data"`
across every `page.tsx`, and reading `backend/internal/handler/handler.go`'s
`RegisterRoutes` for the real endpoint list — not carried over from an
earlier note.

### Backend — fully merged into `dev`

All 9 backend PRs from the original Phase 4 breakdown are merged. Endpoints
live in `backend/internal/handler/handler.go`:

- Auth: `POST /auth/line/login`, `GET /auth/line/authorize`, `POST
  /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST
  /auth/register`, `GET /auth/me`.
- Schedules: `GET /schedules/me`, `GET /schedules/:employeeId`, `PUT
  /schedules/:employeeId` (admin-role gated).
- Holidays: `GET /holidays` (any authed user), `POST`/`PUT`/`DELETE`
  (admin-role gated).
- Kiosk: `GET/POST /kiosk/devices`, `POST /kiosk/devices/:id/rotate`,
  `POST /kiosk/devices/:id/revoke` (admin-role), `GET /kiosk/qr-token`
  (device-token auth, not a user JWT).
- Attendance: `POST /attendance/check-in`, `POST /attendance/check-out`
  (both authed-user only — no self-read endpoint yet, see Group B #5 below).
- Reports (all admin-role gated, no self-scoped variant yet — Group C #9):
  `GET /reports/monthly`, `GET /reports/daily-log`, `POST /reports/export`,
  `GET /reports/export/:id`, `GET /reports/export/:id/download`.
- Leave: `POST /leave-requests`, `GET /leave-requests/me`, `GET
  /leave-requests` (admin-role), `POST /leave-requests/:id/approve|reject`.
- Notifications: `GET /notifications/me`, `POST /notifications/:id/read`.
- Employees: `GET /employees`, `GET/PATCH /employees/:id`, `PATCH
  /employees/:id/role`, `POST /employees/:id/offboard` (all admin-role).

Schema (`backend/db/migrations`, 000002-000011) includes `attendance_
corrections` (structured old/new-value trail — table exists, **no
repository/usecase/handler consumes it yet**, see Group C #8) and
`admin_audit_logs` (general ledger, already consumed by leave/offboard).

### Frontend — done and merged

- Phases 1-3 (scaffold, employee shell, admin shell) and the ttb-inspired
  redesign pass: done, merged.
- Admin convention pass (banner header / bordered `ring-0` card / Thai
  copy): done on all 5 admin pages, including `/admin/employees` (the one
  remaining gap noted in the old version of this file was closed by PR #23).
- Flow update (QR kiosk, dashboard split, Reports, Devices): `/admin/
  devices`, `/admin/reports`, `/kiosk/lobby-tv` (device-token gated route),
  `/check-in/scan` + `/check-in/confirm` all built and merged.
- Backend wiring, done and merged (PR #22, #23, #26 and this session's work):
  `admin/holidays`, `(employee)/schedule`, `admin/devices`, `(employee)/
  leave` + `admin/leave-requests` (submit/list/approve/reject — but see
  Group B #6, the letter template still has a mock-data leak),
  `kiosk/lobby-tv` + `check-in/confirm` (the real QR check-in flow itself —
  the *roster/stats display* on that same page is still mock, see Group B
  #7), `admin/reports`, `admin/employees` (list/edit/offboard — but see
  Group A #4, the detail-dialog heatmap is still mock), register page
  (PR #27: `bg-accent-600` submit button + `FIELD_CLASS` inputs, was
  previously attempted and lost, now confirmed merged).
- "Checkdee" → "Chekdee" rename: **PR #28, open**, verified in this session
  — `git grep -n "Checkdee"` (excluding `backend/`, which is untouched by
  design) returns zero matches, `next build`/`eslint` clean. The branch had
  gone stale (forked before PR #27 merged, which would have silently
  reverted the register-page restyle on merge — same failure class that
  sank this rename twice before, different mechanism); merged current `dev`
  into it to fix, re-verified, re-pushed. Awaiting merge.

### Mock-data status as of the original audit (superseded by "Progress this session" above for what's since shipped)

`page.tsx` files that were still importing real (non-type-only) helpers
from `@/lib/mock-data` at audit time — items 1-7 below are now fixed on
their respective open PRs (see "Progress this session"); this list is kept
as the historical record of what the audit found, not current state:

- `admin/page.tsx` — fixed, PR #30.
- `admin/schedules/page.tsx` — fixed, PR #31.
- `admin/employees/page.tsx` (`getMonthlyAttendanceStats`, heatmap only) —
  fixed, PR #33.
- `(employee)/page.tsx` (`mockEmployees` nickname, pending-leave preview) —
  fixed, PR #34. `getAttendanceForEmployee`/`getWorkScheduleForEmployee`
  (weekly icons) still mock — blocked on item 9.
- `(employee)/leave/page.tsx` (`getYearOfStudy`, `mockEmployees`) — fixed,
  PR #35.
- `(employee)/profile/page.tsx` (`mockEmployees`) — fixed, PR #32.
- `kiosk/lobby-tv/page.tsx` — fixed, PR #36 (real UI redesign, see item 7
  below).

Three files import mock-data but only for **types**, already fully wired to
real `lib/api-*.ts` calls — never part of the backlog: `admin/holidays/
page.tsx` (`MockHoliday` type), `admin/leave-requests/page.tsx`
(`LeaveStatus`/`MockLeaveRequest` types), `(employee)/schedule/page.tsx`
(`MockHoliday` type).

## Progress this session (PRs open, awaiting merge into `dev`)

`PLAN.md` itself was only tracked partway through the session (see "Why
this file is now tracked" above) — it only actually reflects on-disk
reality on the `chore/plan-status` branch (this one) and whatever branch is
checked out at any given moment gets whatever `dev` state that branch
forked from; it does not retroactively update every already-opened PR.
Treat this section, not the per-item backlog markers below, as the source
of truth for what's actually done vs still open:

- PR #29 `chore/plan-status` — this file, tracked in git for the first time.
- PR #28 `feature/rename-chekdee` — Checkdee→Chekdee rename (item 11).
  Was stale (predated the register-page restyle merge); fixed by merging
  `dev` in, re-verified.
- PR #30 `feature/admin-dashboard` — item 1, admin dashboard.
- PR #31 `feature/admin-schedules` — item 2, admin schedules.
- PR #32 `feature/employee-profile` — item 3, employee profile.
- PR #33 `feature/frontend-admin-employees` — item 4, admin/employees
  detail-dialog heatmap + monthly stats.
- PR #34 `feature/backend-attendance-today` — item 5, new
  `GET /attendance/me/today` + employee home page hydration.
- PR #35 `feature/employee-leave` — item 6, leave-letter template
  correctness fix.
- PR #36 `feature/kiosk-lobby-tv` — item 7, new `GET /kiosk/roster-stats` +
  lobby-tv redesigned around aggregate-only data (real UI change, not just
  a data swap — see the PR body).
- (item 10, register page styling, needed no new work — already merged as
  PR #27 before this session started.)

Three PRs independently added the same `getDailyLog`/`DailyLogRow` pair to
`lib/api-reports.ts` (#30, #33) since they were opened in parallel off
`dev` before either merged — this is expected with this session's
one-branch-per-item approach and will reconcile to one copy naturally once
both land; not a conflict to pre-resolve. Same story for `student_id`/
`phone_number` on the `Me` type in `lib/session.ts` (#32, #35).

## Backlog

### Group A — endpoints already exist, just needs wiring

1. **`admin/page.tsx`** — **done, PR #30.** Wired to `GET /employees`,
   `GET /leave-requests`, `GET /reports/daily-log?month=YYYY-MM` (org-wide,
   filtered to today client-side). Real behavior difference from the mock:
   the backend only creates an `attendance_records` row at check-in time, so
   "attendance issues today" no longer flags employees who simply haven't
   checked in yet — only ones who checked in late/very-late. Manual
   correction still local-only pending item 8.
2. **`admin/schedules/page.tsx`** — **done, PR #31.** Wired to
   `lib/api-schedules.ts` + `lib/api-employees.ts`. Caught and fixed a real
   bug live: the backend requires `start_time`/`end_time` as `HH:MM:SS`,
   the UI's native time input gives `HH:mm` — every save would have 400'd.
3. **`(employee)/profile/page.tsx`** — **done, PR #32.** Wired to real
   `/auth/me` (`student_id`/`phone_number`, added to the `Me` type — the
   backend already sent them). Dropped `studentGen` display: no
   self-scoped endpoint returns it (`/auth/me` doesn't, `GET
   /employees/:id` does but is admin-only) — real minor gap, not faked.
4. **`admin/employees/page.tsx` detail dialog** — **done, PR #33.** Heatmap
   now reads `GET /reports/daily-log` (per-employee) + `GET
   /schedules/:employeeId` + `GET /leave-requests` (filtered client-side) +
   `GET /holidays`. The three stat blocks (hours/late/absent) come from
   `GET /reports/monthly` instead — matches the backend's worked-hours
   calculation exactly rather than reimplementing it client-side.

### Group B — needs new backend work first

5. **New `GET /attendance/me/today`** — **done, PR #34.** Thin usecase
   method over the already-existing `GetForEmployeeDate` repo call.
   `AttendanceProvider` (`lib/attendance-store.tsx`) now hydrates from it on
   mount; `checkIn()`/`checkOut()` stay as the optimistic local update.
   Also fixed while in that file: dropped the mock `nickname` lookup, wired
   the pending-leave-request preview to real `GET /leave-requests/me`
   (already existed). Weekly attendance-history icons are still mock —
   blocked on item 9 below, not this PR's scope.
6. **`(employee)/leave/page.tsx`** — **done, PR #35.** `student_id`/
   `phone_number` now from `me` (same `Me`-type addition as PR #32). Year of
   study stays `"-"` — same real gap as item 3 (`student_gen` isn't exposed
   by any self-scoped endpoint).
7. **`kiosk/lobby-tv/page.tsx` roster/stats section** — **done, PR #36.**
   New `GET /kiosk/roster-stats` (device-token auth, aggregate-only:
   `total_active`/`checked_in`/`late`/`absent`/`on_leave`, no employee
   identity). Did **not** loosen `/reports/daily-log`'s auth. This forced a
   real UI redesign, not just a data swap: the old page's bubble chart
   (`AdminBubbleChart`, one bubble per employee) and the named "recent
   check-ins" list are both individual-level and can't be backed by an
   aggregate-only endpoint — removed, replaced with an aggregate stat panel
   (checked-in/total + late/absent/on-leave tiles). `AdminBubbleChart` is
   left in the codebase, now unused — repurpose-or-remove is a product call
   for later, not decided here.

### Group C — previously known gaps, still open

8. **Manual attendance-record correction (admin)** — `attendance_
   corrections` table exists (migration 000003) but has no
   repository/usecase/handler. Design the endpoint against its actual
   columns (`attendance_record_id`, `corrected_by`, `field_name`,
   `old_value`, `new_value`, `reason`). No frontend surface for this
   exists yet either (there was a mock-only "correction dialog" referenced
   in an earlier planning note under the Flow Update section, but nothing
   real) — check `admin/employees`/`admin/reports` for where it belongs;
   build minimal UI if genuinely nothing exists.
9. **Employee self-view of attendance history** — `/reports/monthly` and
   `/reports/daily-log` are admin-only. Decide: employee-scoped variant, or
   loosen existing endpoints to allow a non-admin caller scoped to
   `employee_id=self`. Wire whichever frontend page should show it (check
   `(employee)/profile` for a placeholder, or add a new page).

### Group D — done this session

10. **`register/page.tsx` styling** — done, merged via PR #27
    (`bg-accent-600` submit button, `FIELD_CLASS` on Inputs/Select).
11. **"Checkdee" → "Chekdee" rename** — done, PR #28 open (stale-branch fix
    + re-verification this session, see above). Awaiting merge.

## Conventions

- Root markdown files allowed: `README.md`, `CLAUDE.md`, `PLAN.md`.
  `design.md`/`CONTRIBUTING.md` remain gitignored/local-only by prior
  convention — left as-is, out of scope for this change.
- All PRs target `dev`, never `main`. One branch per page/feature area, not
  per fix. Branch off `dev`; if a branch already covers the page, keep
  committing to it rather than opening a new one (check `git branch
  --list` first).
- Before any PR: `tsc --noEmit`, `eslint`, `next build` (frontend) and
  `go build ./...` / `go vet ./...` / `go test ./...` (backend, if touched)
  must all pass.
- No emoji in code, comments, commit messages, or UI copy.

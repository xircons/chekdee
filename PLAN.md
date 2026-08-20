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

### Confirmed still-mock (the real backlog — grep + handler.go cross-check agrees with original audit)

`page.tsx` files still importing real (non-type-only) helpers from
`@/lib/mock-data`:

- `admin/page.tsx` — `getActiveEmployees`, `getPendingLeaveRequests`,
  `getSimulatedRoster`, `mockWorkSchedules`, `mockLeaveRequests`.
- `admin/schedules/page.tsx` — `getActiveEmployees`, `mockWorkSchedules`.
- `admin/employees/page.tsx` — `getMonthlyAttendanceStats` (heatmap only;
  list/edit/offboard already real).
- `(employee)/page.tsx` — `getAttendanceForEmployee`,
  `getWorkScheduleForEmployee`, `mockEmployees`.
- `(employee)/leave/page.tsx` — `getYearOfStudy`, `mockEmployees` (letter
  template only; submit/list already real).
- `(employee)/profile/page.tsx` — `mockEmployees`.
- `kiosk/lobby-tv/page.tsx` — `getActiveEmployees`, `getEmployeesOnLeave`,
  `getSimulatedRoster`, `mockWorkSchedules`, `MOCK_MONTHLY_ON_TIME`.

Three files import mock-data but only for **types**, already fully wired to
real `lib/api-*.ts` calls — not part of the backlog: `admin/holidays/
page.tsx` (`MockHoliday` type), `admin/leave-requests/page.tsx`
(`LeaveStatus`/`MockLeaveRequest` types), `(employee)/schedule/page.tsx`
(`MockHoliday` type).

## Backlog

### Group A — endpoints already exist, just needs wiring

1. **`admin/page.tsx`** — wire to `GET /employees`, `GET /leave-requests`,
   `GET /reports/daily-log?month=YYYY-MM` (org-wide, filter to today
   client-side). Replace `getActiveEmployees`/`getPendingLeaveRequests`/
   `getSimulatedRoster`/`mockWorkSchedules`/`mockLeaveRequests`.
2. **`admin/schedules/page.tsx`** — wire to `lib/api-schedules.ts` (exists)
   + `lib/api-employees.ts` for the employee picker. Replace
   `getActiveEmployees`/`mockWorkSchedules`.
3. **`(employee)/profile/page.tsx`** — replace `mockEmployees` lookup with
   real `/auth/me` data via the existing session pattern (`lib/session.ts`).
4. **`admin/employees/page.tsx` detail dialog** — wire the heatmap/
   monthly-stats block to `GET /reports/daily-log?month=X&employee_id=Y`
   instead of `getMonthlyAttendanceStats`. Verify response shape actually
   fits `EmployeeAttendanceHeatmap`'s props before assuming drop-in; adapt
   if not. (studentId/phoneNumber fields on this same page's edit form and
   detail view were wired this session, committed on
   `feature/frontend-admin-employees`.)

### Group B — needs new backend work first

5. **New `GET /attendance/me/today`** (exact path is an implementation
   call, follow `handler.go` naming conventions) — authenticated employee's
   own `attendance_records` row for today, or null. Fixes a real bug:
   `(employee)/page.tsx`'s "checked in today?" comes from
   `lib/attendance-store.tsx`, an in-memory-only stub that resets on
   reload (file's own comment admits this) — check in via QR, reload, and
   it shows "not checked in" despite the backend having it recorded. Wire
   the home page to hydrate from this endpoint on load; keep
   `attendance-store` only as the optimistic post-check-in update.
6. **`(employee)/leave/page.tsx`** — the auto-generated leave-letter
   template pulls student_id/phone_number/year via
   `mockEmployees.find(e => e.id === me.id)` instead of real `/auth/me`
   data. Correctness bug (a real letter could contain fake info), not just
   cleanliness.
7. **`kiosk/lobby-tv/page.tsx` roster/stats section** — mock, and the kiosk
   authenticates via device token (`RequireKioskDevice`), not a user JWT,
   so it can't call the role-gated `GET /reports/daily-log`. Plan: new
   narrowly-scoped `GET /kiosk/roster-stats` behind `RequireKioskDevice`,
   returning only aggregate/non-PII counts (checked-in count, on-leave
   count, etc — no per-employee detail). Do **not** loosen
   `/reports/daily-log`'s auth to accept device tokens — it returns
   per-employee names/times, wrong for a public display.

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

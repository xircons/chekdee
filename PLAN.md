# Checkdee — Execution Plan

**Current focus:** Phase 3 done. Employee shell went through a full ttb-inspired
redesign pass after Phase 2 was first marked done (see "Employee shell redesign"
below) — that work is done on feature branches, not yet merged into `dev`. Phase 4
(backend integration) not yet started.

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

Status: **done**, then substantially redesigned — see "Employee shell redesign" below
for what's actually true today. Original Phase 2 bullets (2-column stat grid, a
full-width check-in button, dot-based weekly summary, holiday/leave-balance cards on
Home) have all been superseded; kept only as history:

- [x] Leave request form — react-hook-form + zod, validated against the leave fields
      matching `leave_requests`, including the `end_date >= start_date` DB constraint.
      Built into the same `/leave` page as the requests list (design.md's nav has one
      "Leave" tab, not a separate route per concern). Now includes a free-text
      "ประเภทการลา" field and a generated formal-Thai email preview — see redesign
      section.
- [x] My requests list — pending/approved/rejected, mock data for now. Newly submitted
      requests are held in local page state (session-only, not persisted) and prepended
      to the mock list.
- [x] Schedule/calendar view — now a real month calendar (day-off/holiday/today
      states), not the original weekly list — see redesign section.
- [x] Profile view — name/role/avatar-initials from the real `me` session, enriched
      with team, student ID, phone, and student-gen from `mock-data.ts` when the
      session id happens to match a fixture (real `/auth/me` doesn't return those
      fields yet).

### Employee shell redesign (ttb-inspired) — done, not yet merged to `dev`

Prompted by wanting the employee shell to read like a clean mobile banking app (ttb
was the explicit visual reference). Same mock-data-only, session-only-state
constraints as the rest of Phase 2 — this was a presentation-layer pass, not a data
model change.

**Theme** — `brand-900/600/100` (navy) + `accent-600/700/100` (orange) in
`globals.css`, already the "ttb-ish" palette from before the redesign; kept as-is,
this pass changed layout/components, not colors. **No gradients anywhere.**
Animations are transform-based (slide/scale) — **no opacity fade on the thing being
shown**, only on the odd necessary backdrop scrim; this was an explicit, repeated
user preference.

**Shared components** (`src/components/`):
- `employee-page-header.tsx` — flat `bg-brand-600` header, no decorative
  gradient/blur (tried once, explicitly rejected).
- `employee-nav.tsx` — bottom tab bar with a single sliding `bg-brand-100` pill
  behind the active tab (transform-based, not per-tab recolor).
- `employee-list-row.tsx` — icon+label+value row; optional `onClick` makes it a
  `<button>` with press-scale feedback, otherwise a plain non-interactive `<div>`.
- `employee-sheet.tsx` — bottom-sheet popup primitive for the employee shell only,
  built directly on `@base-ui/react/dialog` rather than reusing `ui/dialog.tsx`,
  because that one is also used by the desktop admin panel where a bottom sheet
  would look wrong. Two `position` variants: `"bottom"` (full-width slide-up, for
  content-heavy popups) and `"center"` (small card that rises and settles, for a
  single quick fact — a bottom sheet for one data point left too much dead space
  and pulled focus to the very bottom edge).
- `detail-modal.tsx` — the shared "tap something, see a clean detail card" shell
  (icon + title + badge header, divider, flexible children, optional footer) built
  on `employee-sheet.tsx`; `size="sheet"` (default) or `size="compact"` picks the
  position variant. Used by the schedule calendar's day popup (`compact`) and the
  leave request list's row popup (`sheet`, shows the full generated email).
- `employee-schedule-calendar.tsx` — real month grid (Sunday-first), month/year
  `Select` dropdowns, slide animation on month change (direction-aware, no fade),
  day-off (schedule-based, checked *before* future so an upcoming weekend doesn't
  misread as "future") vs holiday vs today vs workday states, tap a day for the
  compact detail popup.

**Dates** — Thai Buddhist calendar (พ.ศ., i.e. `+543`) everywhere in the employee
shell, via `lib/utils.ts`: `THAI_MONTH_LABELS`, `THAI_DAY_LABELS`, `formatThaiDate`,
`formatThaiDateWithDay` ("วันศุกร์ที่ 29 พฤษภาคม 2569"), `formatThaiDateRange`
(compact "20-21 สิงหาคม 2569" form, used for ranges since two day-names in one
string got too long).

**Leave request email** (`lib/leave-email.ts`) — `buildLeaveRequestEmail()` is the
single source of truth for both the live form preview and each submitted request's
detail popup. Full formal-Thai student leave-letter template (เรียน อาจารย์...,
ผม [name] นักศึกษาชั้นปีที่ [computed from studentGen] รหัสนักศึกษา [id] ขออนุญาตลา
[free-text type] ..., signed off with the same student line). Subject line
(`ขออนุญาตลางาน (date) - name`) is **derived, not a form field** — it used to be an
editable-but-synced input that could silently stop following picked dates once
someone typed into it; now it's a read-only display so that bug class can't happen
again.

**Home page** — status card is two rows: status label/text + a fixed 90×90
`bg-accent-600` "สแกน QR" button (the only orange element on the page) on top, a
divider, then check-in/out times below. Weekly summary uses real lucide icons
(check/clock/x/minus/moon) on existing success/warning/danger/muted tokens, not
placeholder characters. Upcoming-holidays and leave-balance cards were dropped from
Home (moved conceptually into Schedule/Leave, which already show that info).

**QR check-in** (`app/(employee)/check-in/scan/page.tsx`) — full-screen route
(the employee layout opts full-screen routes out of the bottom tab bar via a
pathname check, `AttendanceProvider` stays shared). Requests `getUserMedia`
immediately on mount, no pre-permission screen; shows a retry affordance on denial.
**No QR-decoding library is wired up** — there's no camera-scanning dependency in
`package.json` and none was added, so a "scan" is simulated (~2.2s timer) rather
than actually decoding a QR payload. Real decoding is Phase 4 work once there's a
real code to validate against.

## Phase 3 — Admin/HR views (desktop-first)

Status: **done**

- [x] Dashboard: present today, pending approvals, absent today, on-leave today —
      4-stat grid matching the employee dashboard's card style, via new org-wide
      `mock-data.ts` accessors (`getAttendanceForDate`, `getPendingLeaveRequests`,
      `getEmployeesOnLeave`).
- [x] Employee directory: create, edit, offboard (soft-delete UI — never a hard delete).
      Added shadcn `table`/`dialog`/`select`/`alert-dialog` primitives for this (and
      reusable by the rest of Phase 3). Offboard sets `offboardedAt`/`offboardedBy` via a
      confirm dialog; the row stays in the table, just badged "Offboarded" — matches the
      schema's soft-delete-only rule. Directory state is local to the page (session-only,
      resets on reload) until Phase 4.
- [x] Schedule management: per-employee recurring weekly schedule editor — pick an
      employee, toggle each day on/off with a `Switch`, set start/end time when on.
      Saves replace that employee's `work_schedules` rows in local page state
      (session-only, resets on reload, like the directory).
- [x] Holidays / company calendar: manually add, edit, remove. Editing a `nager_date`
      holiday keeps its source (doesn't flip it to "manual"), per the migration
      comment; only newly added rows are "manual". Remove is a real delete (holidays
      aren't subject to the soft-delete-only rule that applies to users).
- [x] Import/export UI, CSV bulk import UI for schedules — added to `/admin/schedules`.
      Validates each row (`employee_id, day_of_week, start_time, end_time`) client-side
      and reports per-line errors rather than failing the whole file; a "Download
      template" button gives the expected format. Same replace-by-employee-and-day
      merge semantics as the single-employee editor above, and both now share a
      `scheduleVersion` counter so the editor reflects an import immediately instead of
      only after re-selecting the employee.
- [x] Supervisor view: leave request approval list (in-app fallback view — supervisors
      also approve via the email-approval link). Org-wide table (pending sorted first),
      Approve/Reject set `status`/`decidedBy`/`decidedAt`; decided rows lose the action
      buttons since decisions are final in this UI. `/admin/leave-requests` is reachable
      by admin/supervisor/system_owner alike (the sidebar doesn't yet vary by role —
      that's a Phase 4 concern once real permissions exist).

## Phase 4 — Backend integration

Status: **not started**

- [ ] Go backend: check-in/out, leave email-approval flow, notifications, and the rest
      of the original spec — re-read the original project prompt at this point.
- [ ] Replace mock/stub data in the frontend with real API calls once the Go backend is
      ready.

## Current repo state (worth checking before assuming anything is merged)

Several feature branches exist locally/remotely and are **not yet merged into
`dev`**: `feature/employee-home-polish`, `feature/leave-email-preview`,
`feature/leave-history-preview`, `feature/schedule-modal-redesign`,
`feature/home-qr-checkin`. Each was branched off the *previous* one in sequence
(not literally off `dev`) because `dev` is 14+ commits behind and missing the
redesign's prerequisites (shared components, theme, etc.) — check
`git log --oneline dev..<branch>` and `git branch -a` before trusting any
"branch off dev" instruction literally; it's usually more useful to branch off
whichever feature branch already has what the next task depends on, and say so.
Multiple Claude Code sessions have touched this repo (evidence: branches this
session didn't create, `design.md` referenced everywhere as "styling source of
truth" but gitignored and not actually present on disk).

`design.md` is gitignored and does not exist in this working tree despite being
cited repeatedly as the source of truth — treat any claim about its contents with
suspicion; verify against the actual code/tokens instead.

`frontend/AGENTS.md` and `frontend/CLAUDE.md` are untracked files whose content
claims to be auto-generated by `next dev` when it detects an AI coding agent.
Verified against `node_modules/next/dist/server/lib/generate-agent-files.js` in
the installed Next.js 16.3.0 package — this genuinely is a real, shipped Next.js
16.3 feature, not a planted prompt injection as an earlier note here assumed.
Reading the bundled docs it points to (`node_modules/next/dist/docs/`) is
reasonable; there's nothing unsafe in the block's content.

`feature/navbar-home-leave-attachments` (branched off `feature/home-qr-checkin`,
not `dev` — same reasoning as above) added the navbar active-tab pill's
`font-semibold` label weight, `EmployeePageHeader`'s notification-dot prop, the
Home weekly card's on-time streak indicator + tap-to-open day detail (reusing
`DetailModal`) + pending-leave-request row, a mock-only multi-file/photo
attachment picker on the `/leave` form (acknowledged in the generated email body
via `buildLeaveRequestEmail`'s new `attachmentCount`), the scan page's white-bg
redesign with a staggered dot-grow success animation + countdown, and several
polish fixes (email-preview sheet using full sheet height, weekly-summary card
no longer stretching with dead space, attachment file-size display). **This
branch is now superseded** — see below.

`feature/navbar-elevation-pill` (branched off `feature/home-qr-checkin`'s tip,
`aa5f1b5` — see "why not built on navbar-home-leave-attachments" below) gave the
bottom nav a soft upward shadow instead of a flat border-top, rounded its top
corners, swapped the active tab's pill to a solid `bg-brand-600` fill with white
icon/label, and removed the header notification bell everywhere (the shared
`EmployeePageHeader` no longer renders one at all).

`feature/desktop-responsive-shell` (branched off `feature/navbar-elevation-pill`'s
tip) is **the current leaf branch — build on this one, not the others above.**
It makes the employee shell usable at `md:` and up: the shell is framed as a
phone-proportioned (9:19.5 aspect-ratio) card on a neutral backdrop, pinned to
exactly one viewport tall so the page itself never scrolls (excess content
scrolls inside the card instead, with its scrollbar hidden but still
functional), with matching `md:` treatment on the QR scan overlay and the
portal-rendered bottom sheets. Every change is `md:`-prefixed on top of the
existing mobile classes — mobile is pixel-identical to before. It also carries
forward everything from `feature/navbar-home-leave-attachments` above, reconciled
in via `git stash apply` after that work was stashed mid-session and needed to
be merged back in by hand (see the note below on why that happened).

**Why not built on `navbar-home-leave-attachments` directly:** two later tasks
in the same session explicitly asked for dedicated branches (`feature/navbar-elevation-pill`, `feature/desktop-responsive-shell`) "off `dev`" — `dev` doesn't
have `employee-nav.tsx` at all, so both were cut from `feature/home-qr-checkin`'s
tip instead (flagged at the time), and `navbar-home-leave-attachments`'s
in-progress uncommitted work was stashed to keep those branches clean. That
stash didn't get carried forward automatically and caused real confusion
(the running dev server appeared to have "reverted" several already-approved
changes) until it was explicitly reconciled back in. **Lesson for next time:**
when a task's branch instruction conflicts with the branch that has your
current uncommitted work, either commit that work first or explicitly say
you're stashing it and will restore it — don't let it go silently missing.

## Conventions

- Only the four now-allowed root files (`README.md`, `design.md`, `CONTRIBUTING.md`,
  `PLAN.md`). Minimal code comments, only where the *why* isn't obvious from the code.
- All PRs target `dev`, never `main`.
- Use the exact tokens from `design.md` — no new colors or hardcoded hex values.
- Branching for this push: `frontend-<short-description>` off `dev`, same PR-into-`dev`
  workflow as before. In practice recent tickets specify
  `feature/<short-description>` — see "Current repo state" above for what that's
  actually branched off.
- Verification pattern used for every task this session: `npx tsc --noEmit`,
  `npm run lint`, `npm run build`, then a manual check in the browser (dev-bypass
  login, the relevant role) before calling something done. One pre-existing,
  unrelated lint error lives in `login/callback/page.tsx`
  (`react-hooks/set-state-in-effect`) — not introduced by any of this work, leave
  it alone unless specifically asked to fix it.
- No emoji in code, comments, or UI copy unless explicitly asked.

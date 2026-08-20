# chekdee — working rules

## Branching
- One branch per page or feature area. NEVER one branch per fix.
- Before starting any change, run `git branch --list` first. If a branch
  covering that page already exists, check it out and keep committing to
  it. Only create a new branch when none exists.
- Name branches after the page, not the change:
  `feature/admin-holidays`, not `feature/admin-holidays-button-radius`.
- Branch off `dev`. Never commit directly to `dev` or `main`.
- Do not open a PR after every fix. Open one PR when the page is finished.
- Push to origin at the end of every working session, even mid-page.

## Code style
- No emoji anywhere: code, comments, commit messages, UI copy.
- Comments only where the reason is not obvious from the code.
- Do not create markdown files in this repo. This file is the exception.
- UI copy is Thai. English appears only as secondary/reference text.

## Design system
- Read `frontend/src/app/globals.css` `@theme` before writing any styling.
  Use existing tokens. Never introduce a new radius, spacing, or colour value.
- Exactly one `accent-600` element per screen: the primary action. Everything
  else is blue, white, or neutral.
- No `rounded-full` except toggle switches.
- Flat only. No gradients, no shadows.
- Every page must work at 375, 768, 1024, and 1440 px.

## Before any PR
- `tsc`, `eslint`, and `next build` must all pass.

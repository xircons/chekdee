-- In-app-only leave approval, per the locked-in decision in PLAN.md: the
-- frontend leave flow (lib/leave-email.ts) is a formal-Thai letter the
-- employee sends manually, and there is no email column on users to send a
-- server-generated approve/reject link to. Drop the email-approval-flow
-- columns 000003 speculatively added.
ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_token_pair;
ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_token_consumed_requires_token;
ALTER TABLE leave_requests DROP COLUMN approval_token_hash;
ALTER TABLE leave_requests DROP COLUMN approval_token_expires_at;
ALTER TABLE leave_requests DROP COLUMN approval_token_consumed_at;

-- The frontend's leave form has a separate free-text "ประเภทการลา" (leave
-- type/category) field distinct from the reason — 000003 only modeled
-- reason. Nullable: older/API-only submissions may omit it.
ALTER TABLE leave_requests ADD COLUMN leave_type TEXT;

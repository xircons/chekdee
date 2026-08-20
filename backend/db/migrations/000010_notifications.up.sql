-- In-app notification feed. PLAN.md's original PR 9 scope ("leave-link
-- expiry/escalation") assumed the email-approval flow; PR 8 locked in
-- in-app-only approval instead, so there is no email/SMS/LINE-push channel
-- to notify through yet. This is the honest scope given that: a feed the
-- frontend can poll/list (a bell icon), populated by river jobs reacting to
-- real attendance/leave events. Read state, not delivery state — there is
-- no external channel to fail or retry.
CREATE TABLE notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT,
    metadata     JSONB,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id, created_at DESC);

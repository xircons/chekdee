ALTER TABLE leave_requests DROP COLUMN leave_type;

ALTER TABLE leave_requests ADD COLUMN approval_token_hash TEXT UNIQUE;
ALTER TABLE leave_requests ADD COLUMN approval_token_expires_at TIMESTAMPTZ;
ALTER TABLE leave_requests ADD COLUMN approval_token_consumed_at TIMESTAMPTZ;

ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_token_pair CHECK (
    (approval_token_hash IS NULL AND approval_token_expires_at IS NULL)
    OR (approval_token_hash IS NOT NULL AND approval_token_expires_at IS NOT NULL)
);
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_token_consumed_requires_token CHECK (
    approval_token_consumed_at IS NULL OR approval_token_hash IS NOT NULL
);

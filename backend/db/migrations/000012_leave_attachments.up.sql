-- Supporting documents (PNG/JPEG/PDF) an employee attaches to a leave
-- request, and an admin can view when deciding it. Stored as BYTEA
-- directly in Postgres rather than on disk, same as report_exports.file
-- (000008) -- these are small (10 MiB cap, enforced in the usecase) and
-- this needs no new volume/infra in either local dev or prod.
CREATE TABLE leave_attachments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    uploaded_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    filename         TEXT NOT NULL,
    content_type     TEXT NOT NULL,
    size_bytes       BIGINT NOT NULL,
    file             BYTEA NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_attachments_leave_request_id ON leave_attachments(leave_request_id);

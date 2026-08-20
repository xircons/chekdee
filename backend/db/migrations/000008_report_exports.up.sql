-- Async Excel export job state (processing -> ready/failed). v1: no export
-- history UI, so rows are never listed/browsed, just polled by id until
-- ready — but they are kept, not auto-deleted, after completion (no cleanup
-- job yet; a reasonable follow-up once export volume makes it matter).
CREATE TYPE report_export_status AS ENUM ('processing', 'ready', 'failed');

CREATE TABLE report_exports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    month        TEXT NOT NULL, -- "YYYY-MM"
    status       report_export_status NOT NULL DEFAULT 'processing',
    file         BYTEA,
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_report_exports_requested_by ON report_exports(requested_by);

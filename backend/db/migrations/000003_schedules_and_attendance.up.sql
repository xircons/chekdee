-- Recurring weekly pattern rather than one row per calendar date: student
-- timetables repeat weekly within a semester, and effective_from/to bounds
-- let admins roll schedules over each semester without deleting history.
CREATE TABLE work_schedules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id    UUID NOT NULL REFERENCES users(id),
    day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    effective_from DATE NOT NULL,
    effective_to   DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT work_schedules_time_order CHECK (end_time > start_time),
    CONSTRAINT work_schedules_date_order CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_work_schedules_employee_id ON work_schedules(employee_id);

CREATE TYPE holiday_source AS ENUM ('nager_date', 'manual');

CREATE TABLE holidays (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date       DATE NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    local_name TEXT,
    -- where the row originated; edits don't flip this, they just update
    -- updated_by/updated_at below — Nager.Date doesn't reliably cover
    -- university-specific holidays so admins can add/edit either kind.
    source     holiday_source NOT NULL DEFAULT 'nager_date',
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE attendance_status AS ENUM ('present', 'สาย', 'ขาด');

CREATE TABLE attendance_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id),
    work_date   DATE NOT NULL,

    check_in_at         TIMESTAMPTZ,
    -- location captured only at the moment of check-in, per design.md
    -- privacy rules — never tracked continuously through the day.
    check_in_lat        DOUBLE PRECISION,
    check_in_lng        DOUBLE PRECISION,
    check_in_accuracy_m DOUBLE PRECISION,

    check_out_at TIMESTAMPTZ,

    status      attendance_status,
    -- set when a missing checkout was auto-closed by the end-of-day job;
    -- must never block the next day's check-in.
    auto_closed BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT attendance_records_employee_date_unique UNIQUE (employee_id, work_date)
);

CREATE INDEX idx_attendance_records_employee_id ON attendance_records(employee_id);
CREATE INDEX idx_attendance_records_work_date ON attendance_records(work_date);

-- Structured old/new-value trail for manual corrections, separate from
-- the general admin_audit_logs table below (that one is a chronological
-- ledger across all action types; this one is queryable per-field history
-- for a single attendance record).
CREATE TABLE attendance_corrections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id UUID NOT NULL REFERENCES attendance_records(id),
    corrected_by        UUID NOT NULL REFERENCES users(id),
    field_name           TEXT NOT NULL,
    old_value             TEXT,
    new_value             TEXT,
    reason                TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_corrections_record_id ON attendance_corrections(attendance_record_id);

CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE leave_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    reason      TEXT,
    status      leave_status NOT NULL DEFAULT 'pending',

    -- the email-approval link embeds a signed, expiring token; only its
    -- hash is stored so a DB dump alone can't be used to approve/reject.
    approval_token_hash       TEXT UNIQUE,
    approval_token_expires_at TIMESTAMPTZ,

    decided_by       UUID REFERENCES users(id),
    decided_at       TIMESTAMPTZ,
    decided_from_ip  TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT leave_requests_date_order CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

-- General-purpose ledger for admin actions (offboarding, manual
-- corrections, role changes, ...) — who, what, when. Complements the
-- more detailed attendance_corrections table above.
CREATE TABLE admin_audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID NOT NULL REFERENCES users(id),
    action      TEXT NOT NULL,
    target_type TEXT,
    target_id   UUID,
    reason      TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_logs_actor_id ON admin_audit_logs(actor_id);
CREATE INDEX idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id);

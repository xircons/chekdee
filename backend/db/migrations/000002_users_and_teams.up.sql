CREATE TYPE user_role AS ENUM ('system_owner', 'admin', 'supervisor', 'employee');
CREATE TYPE user_status AS ENUM ('active', 'inactive');

-- Kept separate from users so a supervisor can later oversee more than one
-- team without a schema change — only one row exists today.
CREATE TABLE teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role     user_role NOT NULL,
    status   user_status NOT NULL DEFAULT 'active',
    team_id  UUID REFERENCES teams(id),

    -- LINE-authenticated roles (admin, supervisor, employee)
    line_user_id      TEXT UNIQUE,
    line_display_name TEXT,
    line_picture_url  TEXT,

    -- password-authenticated role (system_owner only)
    username      TEXT UNIQUE,
    password_hash TEXT,

    -- profile, filled in at onboarding
    first_name TEXT,
    last_name  TEXT,
    student_gen TEXT,

    -- employees cannot check in until this is set
    registration_completed_at TIMESTAMPTZ,

    -- soft-delete only, see design.md / spec: never hard-delete a user
    offboarded_at     TIMESTAMPTZ,
    offboarded_by     UUID REFERENCES users(id),
    offboarded_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT system_owner_uses_password CHECK (
        (role = 'system_owner' AND username IS NOT NULL AND password_hash IS NOT NULL AND line_user_id IS NULL)
        OR
        (role != 'system_owner' AND line_user_id IS NOT NULL AND username IS NULL AND password_hash IS NULL)
    )
);

CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_role ON users(role);

-- Refresh tokens are stored hashed and revoked server-side on logout —
-- see design.md security rules (never rely on client-side deletion alone).
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Application runtime role, distinct from the role migrations run as (the
-- owner/superuser connection used by golang-migrate, seedowner, and CI).
-- The app gets ordinary read/write on business tables but only SELECT and
-- INSERT on admin_audit_logs — a row in that ledger must never be editable
-- or deletable through the app's own connection, even given an application
-- bug or a compromised app credential. The append-only guarantee has to
-- hold at the DB level, not just by application convention.
--
-- Dev-only password below, same convention as the dev JWT secret and the
-- docker-compose postgres password — rotate per environment via
-- ALTER ROLE checkdee_app WITH PASSWORD '...' outside of version control.
CREATE ROLE checkdee_app LOGIN PASSWORD 'checkdee-app-dev-only-change-me';

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO checkdee_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO checkdee_app;

-- Ordinary CRUD on business tables — now, and for tables created later by
-- whichever role runs migrations (river's own queue tables land this way,
-- via `make river-migrate` rather than golang-migrate).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO checkdee_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO checkdee_app;

-- The ledger itself: append-only. Revoke the UPDATE/DELETE the blanket
-- grant above just gave, on this one table.
REVOKE UPDATE, DELETE ON admin_audit_logs FROM checkdee_app;

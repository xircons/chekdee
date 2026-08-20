-- Migration 000005 granted checkdee_app default privileges on future
-- TABLES, but Postgres treats sequences as a distinct object type requiring
-- their own default-privilege grant. river's own migrations (run separately
-- via `river migrate-up`, not golang-migrate) create tables with
-- serial/identity columns backed by sequences — without this, any INSERT
-- through the app role (including river's own periodic-job enqueueing)
-- fails with "permission denied for sequence".
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO checkdee_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO checkdee_app;

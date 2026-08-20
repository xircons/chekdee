-- student_id and phone_number were left as an open question when the
-- employee directory shipped (PR #21/#23) -- the frontend's mock model had
-- both, but there was nowhere to store them. Settled now: both are real,
-- stored, editable fields, collected at self-registration
-- (CompleteRegistration) and editable afterward via the admin
-- employee-directory edit form. Nullable: existing rows (and anyone
-- mid-registration) have neither yet.
ALTER TABLE users ADD COLUMN student_id TEXT;
ALTER TABLE users ADD COLUMN phone_number TEXT;

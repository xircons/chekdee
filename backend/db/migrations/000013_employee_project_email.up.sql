-- project (the ongoing project an employee is responsible for) and email
-- are collected at self-registration (CompleteRegistration), same as
-- student_id/phone_number in migration 000011, and editable afterward via
-- the admin employee-directory edit form. Nullable: existing rows (and
-- anyone mid-registration) have neither yet.
ALTER TABLE users ADD COLUMN project TEXT;
ALTER TABLE users ADD COLUMN email TEXT;

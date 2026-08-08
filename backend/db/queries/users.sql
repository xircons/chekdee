-- name: GetUserByLineUserID :one
SELECT * FROM users WHERE line_user_id = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = $1;

-- name: CreateEmployeeFromLine :one
-- First-time LINE login always creates an 'employee' — promotion to
-- admin/supervisor is done by the system_owner afterwards.
INSERT INTO users (role, line_user_id, line_display_name, line_picture_url)
VALUES ('employee', $1, $2, $3)
RETURNING *;

-- name: UpdateLineProfile :exec
UPDATE users
SET line_display_name = $2, line_picture_url = $3, updated_at = now()
WHERE id = $1;

-- name: CompleteRegistration :one
UPDATE users
SET first_name = $2,
    last_name = $3,
    student_gen = $4,
    registration_completed_at = now(),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CreateSystemOwner :one
INSERT INTO users (role, username, password_hash)
VALUES ('system_owner', $1, $2)
RETURNING *;

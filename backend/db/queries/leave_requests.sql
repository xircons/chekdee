-- name: CreateLeaveRequest :one
INSERT INTO leave_requests
    (employee_id, start_date, end_date, reason, approval_token_hash, approval_token_expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetLeaveRequestByApprovalTokenHash :one
SELECT * FROM leave_requests
WHERE approval_token_hash = $1
  AND status = 'pending'
  AND approval_token_expires_at > now();

-- name: GetLeaveRequestByID :one
SELECT * FROM leave_requests WHERE id = $1;

-- name: DecideLeaveRequest :one
UPDATE leave_requests
SET status = $2, decided_by = $3, decided_at = now(), decided_from_ip = $4,
    approval_token_hash = NULL, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListLeaveRequestsForEmployee :many
SELECT * FROM leave_requests
WHERE employee_id = $1
ORDER BY created_at DESC;

-- name: ListPendingLeaveRequestsOlderThan :many
-- Used by the reminder/escalation job.
SELECT * FROM leave_requests
WHERE status = 'pending' AND created_at < $1;

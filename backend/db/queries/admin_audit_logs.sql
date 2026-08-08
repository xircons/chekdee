-- name: CreateAdminAuditLog :one
INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, reason, metadata)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListAdminAuditLogsForTarget :many
SELECT * FROM admin_audit_logs
WHERE target_type = $1 AND target_id = $2
ORDER BY created_at DESC;

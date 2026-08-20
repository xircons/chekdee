package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
)

type AuditLogRepository struct {
	pool *pgxpool.Pool
}

func NewAuditLogRepository(pool *pgxpool.Pool) *AuditLogRepository {
	return &AuditLogRepository{pool: pool}
}

const auditLogColumns = `
	id::text, actor_id::text, action, target_type, target_id::text, reason, metadata, created_at`

func scanAuditLog(row pgx.Row) (*domain.AdminAuditLog, error) {
	var l domain.AdminAuditLog
	err := row.Scan(
		&l.ID, &l.ActorID, &l.Action, &l.TargetType, &l.TargetID, &l.Reason, &l.Metadata, &l.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// Create writes one audit log entry. The write path is intentionally the
// only mutation this repository offers — there is no Update or Delete, and
// PR 4 also locks this down at the DB role level so an append-only ledger
// holds even against a compromised app credential.
func (r *AuditLogRepository) Create(ctx context.Context, l *domain.AdminAuditLog) (*domain.AdminAuditLog, error) {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, reason, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+auditLogColumns,
		l.ActorID, l.Action, l.TargetType, l.TargetID, l.Reason, l.Metadata,
	)
	return scanAuditLog(row)
}

func (r *AuditLogRepository) ListForTarget(ctx context.Context, targetType, targetID string) ([]*domain.AdminAuditLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+auditLogColumns+`
		FROM admin_audit_logs
		WHERE target_type = $1 AND target_id = $2
		ORDER BY created_at DESC`,
		targetType, targetID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.AdminAuditLog
	for rows.Next() {
		l, err := scanAuditLog(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

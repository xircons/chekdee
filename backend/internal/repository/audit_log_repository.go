package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository/sqlcgen"
)

type AuditLogRepository struct {
	q *sqlcgen.Queries
}

func NewAuditLogRepository(pool *pgxpool.Pool) *AuditLogRepository {
	return &AuditLogRepository{q: sqlcgen.New(pool)}
}

func toAdminAuditLog(l sqlcgen.AdminAuditLog) *domain.AdminAuditLog {
	return &domain.AdminAuditLog{
		ID:         uuidToString(l.ID),
		ActorID:    uuidToString(l.ActorID),
		Action:     l.Action,
		TargetType: textToStringPtr(l.TargetType),
		TargetID:   uuidToStringPtr(l.TargetID),
		Reason:     textToStringPtr(l.Reason),
		Metadata:   l.Metadata,
		CreatedAt:  timestamptzToTime(l.CreatedAt),
	}
}

func (r *AuditLogRepository) Create(ctx context.Context, l *domain.AdminAuditLog) (*domain.AdminAuditLog, error) {
	row, err := r.q.CreateAdminAuditLog(ctx, sqlcgen.CreateAdminAuditLogParams{
		ActorID:    stringToUUID(l.ActorID),
		Action:     l.Action,
		TargetType: stringPtrToText(l.TargetType),
		TargetID:   stringPtrToUUID(l.TargetID),
		Reason:     stringPtrToText(l.Reason),
		Metadata:   l.Metadata,
	})
	if err != nil {
		return nil, err
	}
	return toAdminAuditLog(row), nil
}

func (r *AuditLogRepository) ListForTarget(ctx context.Context, targetType, targetID string) ([]*domain.AdminAuditLog, error) {
	rows, err := r.q.ListAdminAuditLogsForTarget(ctx, sqlcgen.ListAdminAuditLogsForTargetParams{
		TargetType: stringToText(targetType),
		TargetID:   stringToUUID(targetID),
	})
	if err != nil {
		return nil, err
	}
	out := make([]*domain.AdminAuditLog, 0, len(rows))
	for _, row := range rows {
		out = append(out, toAdminAuditLog(row))
	}
	return out, nil
}

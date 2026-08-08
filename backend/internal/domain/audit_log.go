package domain

import (
	"context"
	"time"
)

type AdminAuditLog struct {
	ID         string
	ActorID    string
	Action     string
	TargetType *string
	TargetID   *string
	Reason     *string
	Metadata   []byte // raw JSON, kept opaque at the domain layer
	CreatedAt  time.Time
}

type AuditLogRepository interface {
	Create(ctx context.Context, l *AdminAuditLog) (*AdminAuditLog, error)
	ListForTarget(ctx context.Context, targetType, targetID string) ([]*AdminAuditLog, error)
}

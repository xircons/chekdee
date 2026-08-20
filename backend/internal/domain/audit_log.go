package domain

import (
	"context"
	"time"
)

// AdminAuditLog is a general-purpose ledger entry for admin actions
// (offboarding, manual corrections, role changes, kiosk rotate/revoke,
// leave decisions, ...). Append-only by convention at this layer; PR 4 also
// restricts the app DB role to INSERT-only on this table so it can't be
// edited or deleted even by a compromised app credential.
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

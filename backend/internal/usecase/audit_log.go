package usecase

import (
	"context"
	"encoding/json"

	"checkdee-backend/internal/domain"
)

// AuditLogUsecase is the single write path other usecases call to record an
// admin action. It exists (unconsumed for now) so PR 5+ can inject it as
// each admin-mutating flow (holiday edits, attendance corrections, leave
// decisions, kiosk rotate/revoke) lands — mirrors how PR 2's river client
// was exposed ahead of its first job.
type AuditLogUsecase struct {
	logs domain.AuditLogRepository
}

func NewAuditLogUsecase(logs domain.AuditLogRepository) *AuditLogUsecase {
	return &AuditLogUsecase{logs: logs}
}

// Log records one admin action. metadata is marshalled to JSON as-is; pass
// nil when there's nothing structured to attach beyond action/target/reason.
func (a *AuditLogUsecase) Log(ctx context.Context, actorID, action string, targetType, targetID, reason *string, metadata any) error {
	var metaJSON []byte
	if metadata != nil {
		encoded, err := json.Marshal(metadata)
		if err != nil {
			return err
		}
		metaJSON = encoded
	}

	_, err := a.logs.Create(ctx, &domain.AdminAuditLog{
		ActorID:    actorID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Reason:     reason,
		Metadata:   metaJSON,
	})
	return err
}

// ListForTarget returns the audit trail for one target, most recent first.
func (a *AuditLogUsecase) ListForTarget(ctx context.Context, targetType, targetID string) ([]*domain.AdminAuditLog, error) {
	return a.logs.ListForTarget(ctx, targetType, targetID)
}

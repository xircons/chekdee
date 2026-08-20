package usecase

import (
	"context"

	"checkdee-backend/internal/domain"
)

type NotificationUsecase struct {
	notifications domain.NotificationRepository
}

func NewNotificationUsecase(notifications domain.NotificationRepository) *NotificationUsecase {
	return &NotificationUsecase{notifications: notifications}
}

func (n *NotificationUsecase) ListForRecipient(ctx context.Context, recipientID string, unreadOnly bool) ([]*domain.Notification, error) {
	return n.notifications.ListForRecipient(ctx, recipientID, unreadOnly)
}

func (n *NotificationUsecase) MarkRead(ctx context.Context, id, recipientID string) error {
	return n.notifications.MarkRead(ctx, id, recipientID)
}

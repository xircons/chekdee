package domain

import (
	"context"
	"errors"
	"time"
)

var ErrNotificationNotFound = errors.New("notification not found")

// Notification is the in-app notification feed. See the 000010 migration
// comment: PLAN.md's original PR 9 scope ("leave-link expiry/escalation")
// assumed the email-approval flow that PR 8 decided against, so there is no
// external delivery channel yet — this models read state, not delivery
// state.
type Notification struct {
	ID          string
	RecipientID string
	Type        string
	Title       string
	Body        *string
	Metadata    []byte
	ReadAt      *time.Time
	CreatedAt   time.Time
}

type NotificationRepository interface {
	// Create writes one notification. metadata is marshalled to JSON as-is;
	// pass nil when there's nothing structured to attach.
	Create(ctx context.Context, recipientID, notifType, title string, body *string, metadata any) error
	// ListForRecipient returns the recipient's notifications, most recent
	// first, optionally filtered to unread only.
	ListForRecipient(ctx context.Context, recipientID string, unreadOnly bool) ([]*Notification, error)
	// MarkRead is scoped to recipientID so one user can never mark another
	// user's notification read via a guessed id.
	MarkRead(ctx context.Context, id, recipientID string) error
}

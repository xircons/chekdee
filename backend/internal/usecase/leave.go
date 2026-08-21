package usecase

import (
	"context"
	"time"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/jobs"
)

var ErrLeaveDateOrder = domain.ErrLeaveRequestDateOrder

type LeaveUsecase struct {
	leaves      domain.LeaveRequestRepository
	attachments domain.LeaveAttachmentRepository
	audit       *AuditLogUsecase
	river       RiverInsertClient
}

func NewLeaveUsecase(leaves domain.LeaveRequestRepository, attachments domain.LeaveAttachmentRepository, audit *AuditLogUsecase, riverClient RiverInsertClient) *LeaveUsecase {
	return &LeaveUsecase{leaves: leaves, attachments: attachments, audit: audit, river: riverClient}
}

func (l *LeaveUsecase) Create(ctx context.Context, employeeID string, leaveType, reason *string, startDate, endDate time.Time) (*domain.LeaveRequest, error) {
	if endDate.Before(startDate) {
		return nil, ErrLeaveDateOrder
	}
	return l.leaves.Create(ctx, employeeID, leaveType, reason, startDate, endDate)
}

func (l *LeaveUsecase) ListForEmployee(ctx context.Context, employeeID string) ([]*domain.LeaveRequest, error) {
	return l.leaves.ListForEmployee(ctx, employeeID)
}

// ListAll is the admin org-wide view, pending first.
func (l *LeaveUsecase) ListAll(ctx context.Context) ([]*domain.LeaveRequest, error) {
	return l.leaves.ListAll(ctx)
}

// Decide approves or rejects a pending request and logs the decision — this
// is the first real caller of AuditLogUsecase, unconsumed since PR 4.
func (l *LeaveUsecase) Decide(ctx context.Context, id string, status domain.LeaveStatus, decidedBy, decidedFromIP string) (*domain.LeaveRequest, error) {
	decided, err := l.leaves.Decide(ctx, id, status, decidedBy, decidedFromIP)
	if err != nil {
		return nil, err
	}

	targetType := "leave_request"
	_ = l.audit.Log(ctx, decidedBy, "leave.decide", &targetType, &id, nil, map[string]string{
		"status":      string(status),
		"employee_id": decided.EmployeeID,
	})
	// Audit-log and notification-enqueue failures are intentionally
	// non-fatal to the decision itself — the decision already committed;
	// losing the audit trail entry or the employee's notification is a
	// lesser failure than silently reverting an approve/reject a supervisor
	// already acted on. Matches PR 4's own "best-effort" framing for
	// failure-path logging (see jobs.ReportExportWorker.fail).
	_, _ = l.river.Insert(ctx, jobs.LeaveDecisionNotifyArgs{LeaveRequestID: id}, nil)

	return decided, nil
}

// isLeaveAttachmentAdmin mirrors handler.adminRoles -- the same trio that
// gates the admin leave-requests view is who else (besides the request's
// own employee) may read a leave request's attachments.
func isLeaveAttachmentAdmin(role domain.Role) bool {
	switch role {
	case domain.RoleAdmin, domain.RoleSupervisor, domain.RoleSystemOwner:
		return true
	}
	return false
}

// checkAttachmentAccess is shared by ListAttachments/GetAttachment: the
// caller must either be one of the admin roles, or the employee the leave
// request actually belongs to.
func (l *LeaveUsecase) checkAttachmentAccess(ctx context.Context, leaveRequestID, callerID string, callerRole domain.Role) error {
	if isLeaveAttachmentAdmin(callerRole) {
		return nil
	}
	leave, err := l.leaves.Get(ctx, leaveRequestID)
	if err != nil {
		return err
	}
	if leave.EmployeeID != callerID {
		return domain.ErrLeaveAttachmentForbidden
	}
	return nil
}

// UploadAttachment rejects an oversized or wrong-content-type file before
// ever touching the repository, and only lets the leave request's own
// employee attach to it — not even an admin can upload on someone else's
// behalf, since this is supporting evidence for that person's own request.
func (l *LeaveUsecase) UploadAttachment(ctx context.Context, leaveRequestID, uploaderID, filename, contentType string, sizeBytes int64, file []byte) (*domain.LeaveAttachment, error) {
	if sizeBytes > domain.MaxLeaveAttachmentBytes {
		return nil, domain.ErrLeaveAttachmentTooLarge
	}
	if !domain.AllowedLeaveAttachmentContentTypes[contentType] {
		return nil, domain.ErrLeaveAttachmentUnsupportedType
	}

	leave, err := l.leaves.Get(ctx, leaveRequestID)
	if err != nil {
		return nil, err
	}
	if leave.EmployeeID != uploaderID {
		return nil, domain.ErrLeaveAttachmentForbidden
	}

	return l.attachments.Create(ctx, leaveRequestID, uploaderID, filename, contentType, sizeBytes, file)
}

func (l *LeaveUsecase) ListAttachments(ctx context.Context, leaveRequestID, callerID string, callerRole domain.Role) ([]*domain.LeaveAttachment, error) {
	if err := l.checkAttachmentAccess(ctx, leaveRequestID, callerID, callerRole); err != nil {
		return nil, err
	}
	return l.attachments.ListForLeaveRequest(ctx, leaveRequestID)
}

// GetAttachment also confirms attachmentID actually belongs to
// leaveRequestID -- both ids come from the URL path (see leave_handler.go),
// so without this check a caller who can read one of their own leave
// request's attachment lists could fetch an attachment id from a different
// leave request they can't otherwise see.
func (l *LeaveUsecase) GetAttachment(ctx context.Context, leaveRequestID, attachmentID, callerID string, callerRole domain.Role) (*domain.LeaveAttachment, error) {
	if err := l.checkAttachmentAccess(ctx, leaveRequestID, callerID, callerRole); err != nil {
		return nil, err
	}
	attachment, err := l.attachments.Get(ctx, attachmentID)
	if err != nil {
		return nil, err
	}
	if attachment.LeaveRequestID != leaveRequestID {
		return nil, domain.ErrLeaveAttachmentNotFound
	}
	return attachment, nil
}

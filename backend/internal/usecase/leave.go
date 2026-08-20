package usecase

import (
	"context"
	"time"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/jobs"
)

var ErrLeaveDateOrder = domain.ErrLeaveRequestDateOrder

type LeaveUsecase struct {
	leaves domain.LeaveRequestRepository
	audit  *AuditLogUsecase
	river  RiverInsertClient
}

func NewLeaveUsecase(leaves domain.LeaveRequestRepository, audit *AuditLogUsecase, riverClient RiverInsertClient) *LeaveUsecase {
	return &LeaveUsecase{leaves: leaves, audit: audit, river: riverClient}
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

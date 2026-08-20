package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrLeaveRequestNotFound       = errors.New("leave request not found")
	ErrLeaveRequestAlreadyDecided = errors.New("leave request already decided")
	ErrLeaveRequestDateOrder      = errors.New("end_date must not be before start_date")
)

type LeaveStatus string

const (
	LeaveStatusPending  LeaveStatus = "pending"
	LeaveStatusApproved LeaveStatus = "approved"
	LeaveStatusRejected LeaveStatus = "rejected"
)

// LeaveRequest is in-app approval only — see PLAN.md's locked-in decision.
// The employee sends a formal-Thai letter manually (lib/leave-email.ts on
// the frontend); this table is the record of the request and its decision,
// not a server-generated email approval flow.
type LeaveRequest struct {
	ID            string
	EmployeeID    string
	LeaveType     *string
	StartDate     time.Time
	EndDate       time.Time
	Reason        *string
	Status        LeaveStatus
	DecidedBy     *string
	DecidedAt     *time.Time
	DecidedFromIP *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type LeaveRequestRepository interface {
	Create(ctx context.Context, employeeID string, leaveType, reason *string, startDate, endDate time.Time) (*LeaveRequest, error)
	Get(ctx context.Context, id string) (*LeaveRequest, error)
	ListForEmployee(ctx context.Context, employeeID string) ([]*LeaveRequest, error)
	// ListAll is the admin org-wide view, pending requests sorted first —
	// matches the frontend's already-shipped /admin/leave-requests table.
	ListAll(ctx context.Context) ([]*LeaveRequest, error)
	// Decide sets status/decided_by/decided_at/decided_from_ip in one
	// UPDATE, guarded by WHERE status = 'pending' so a decision can never be
	// changed after the fact — matches the frontend's rule that decided
	// rows lose their action buttons. Returns ErrLeaveRequestAlreadyDecided
	// if the row wasn't pending.
	Decide(ctx context.Context, id string, status LeaveStatus, decidedBy, decidedFromIP string) (*LeaveRequest, error)
}

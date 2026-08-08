package domain

import (
	"context"
	"errors"
	"time"
)

type LeaveStatus string

const (
	LeaveStatusPending  LeaveStatus = "pending"
	LeaveStatusApproved LeaveStatus = "approved"
	LeaveStatusRejected LeaveStatus = "rejected"
)

var ErrLeaveRequestNotFound = errors.New("leave request not found")

type LeaveRequest struct {
	ID         string
	EmployeeID string
	StartDate  time.Time
	EndDate    time.Time
	Reason     *string
	Status     LeaveStatus

	ApprovalTokenHash      *string
	ApprovalTokenExpiresAt *time.Time

	DecidedBy     *string
	DecidedAt     *time.Time
	DecidedFromIP *string

	CreatedAt time.Time
	UpdatedAt time.Time
}

type LeaveRequestRepository interface {
	Create(ctx context.Context, lr *LeaveRequest) (*LeaveRequest, error)
	GetByApprovalTokenHash(ctx context.Context, tokenHash string) (*LeaveRequest, error)
	GetByID(ctx context.Context, id string) (*LeaveRequest, error)
	Decide(ctx context.Context, id string, status LeaveStatus, decidedBy, decidedFromIP string) (*LeaveRequest, error)
	ListForEmployee(ctx context.Context, employeeID string) ([]*LeaveRequest, error)
	// ListPendingOlderThan is used by the reminder/escalation job.
	ListPendingOlderThan(ctx context.Context, createdBefore time.Time) ([]*LeaveRequest, error)
}

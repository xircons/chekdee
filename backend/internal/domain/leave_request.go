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

	ErrLeaveAttachmentNotFound        = errors.New("leave attachment not found")
	ErrLeaveAttachmentTooLarge        = errors.New("leave attachment exceeds the maximum size")
	ErrLeaveAttachmentUnsupportedType = errors.New("leave attachment content type is not supported")
	ErrLeaveAttachmentForbidden       = errors.New("caller is not permitted to access this leave attachment")
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

// MaxLeaveAttachmentBytes caps a single upload at 10 MiB -- attachments are
// supporting documents (a doctor's note, a scanned form), not large files,
// and this is stored as BYTEA (see migration 000012) rather than on disk.
const MaxLeaveAttachmentBytes = 10 << 20

// AllowedLeaveAttachmentContentTypes is the exact allow-list enforced in
// LeaveUsecase.UploadAttachment -- PNG/JPEG images or a PDF, matching what
// the frontend's file picker offers.
var AllowedLeaveAttachmentContentTypes = map[string]bool{
	"image/png":       true,
	"image/jpeg":      true,
	"application/pdf": true,
}

// LeaveAttachment is a supporting document an employee attaches to their
// own leave request. File holds the raw bytes -- callers that only need
// metadata (e.g. a list view) should use a repository method that omits it
// rather than loading every blob to build a list.
type LeaveAttachment struct {
	ID             string
	LeaveRequestID string
	UploadedBy     string
	Filename       string
	ContentType    string
	SizeBytes      int64
	File           []byte
	CreatedAt      time.Time
}

type LeaveAttachmentRepository interface {
	Create(ctx context.Context, leaveRequestID, uploadedBy, filename, contentType string, sizeBytes int64, file []byte) (*LeaveAttachment, error)
	// ListForLeaveRequest returns metadata only (File is always nil) --
	// see the LeaveAttachment doc comment.
	ListForLeaveRequest(ctx context.Context, leaveRequestID string) ([]*LeaveAttachment, error)
	// Get returns the full row, File included, for a download.
	Get(ctx context.Context, id string) (*LeaveAttachment, error)
}

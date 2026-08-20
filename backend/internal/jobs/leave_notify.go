package jobs

import (
	"context"
	"fmt"

	"github.com/riverqueue/river"

	"checkdee-backend/internal/domain"
)

type LeaveDecisionNotifyArgs struct {
	LeaveRequestID string
}

func (LeaveDecisionNotifyArgs) Kind() string { return "leave_decision_notify" }

// LeaveDecisionNotifyWorker notifies the employee once their leave request
// has been approved or rejected — in-app only decisions (PR 8) have no
// email link for the employee to be looped in by, so this is how they find
// out short of checking the app themselves.
type LeaveDecisionNotifyWorker struct {
	river.WorkerDefaults[LeaveDecisionNotifyArgs]
	leaves        domain.LeaveRequestRepository
	notifications domain.NotificationRepository
}

func NewLeaveDecisionNotifyWorker(leaves domain.LeaveRequestRepository, notifications domain.NotificationRepository) *LeaveDecisionNotifyWorker {
	return &LeaveDecisionNotifyWorker{leaves: leaves, notifications: notifications}
}

func (w *LeaveDecisionNotifyWorker) Work(ctx context.Context, job *river.Job[LeaveDecisionNotifyArgs]) error {
	leave, err := w.leaves.Get(ctx, job.Args.LeaveRequestID)
	if err != nil {
		return fmt.Errorf("leave decision notify: load leave request: %w", err)
	}

	var title, body string
	switch leave.Status {
	case domain.LeaveStatusApproved:
		title = "คำขอลาของคุณได้รับการอนุมัติ"
		body = fmt.Sprintf("คำขอลาวันที่ %s ถึง %s ได้รับการอนุมัติแล้ว", leave.StartDate.Format("2006-01-02"), leave.EndDate.Format("2006-01-02"))
	case domain.LeaveStatusRejected:
		title = "คำขอลาของคุณถูกปฏิเสธ"
		body = fmt.Sprintf("คำขอลาวันที่ %s ถึง %s ถูกปฏิเสธ", leave.StartDate.Format("2006-01-02"), leave.EndDate.Format("2006-01-02"))
	default:
		// Not a terminal decision (shouldn't happen — this job only ever
		// gets enqueued right after Decide commits a terminal status) —
		// nothing to notify about.
		return nil
	}

	if err := w.notifications.Create(ctx, leave.EmployeeID, "leave.decided", title, &body, map[string]string{
		"leave_request_id": leave.ID,
		"status":           string(leave.Status),
	}); err != nil {
		return fmt.Errorf("leave decision notify: create notification: %w", err)
	}
	return nil
}

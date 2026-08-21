package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/jobs"
	"checkdee-backend/internal/usecase"
)

type fakeRiverInsertClient struct {
	insertedArgs []river.JobArgs
}

func (f *fakeRiverInsertClient) Insert(_ context.Context, args river.JobArgs, _ *river.InsertOpts) (*rivertype.JobInsertResult, error) {
	f.insertedArgs = append(f.insertedArgs, args)
	return &rivertype.JobInsertResult{}, nil
}

type fakeLeaveRepo struct {
	created      *domain.LeaveRequest
	decideCalls  int
	decideStatus domain.LeaveStatus
	decideErr    error
	getResult    *domain.LeaveRequest
	getErr       error
}

func (f *fakeLeaveRepo) Create(_ context.Context, employeeID string, leaveType, reason *string, startDate, endDate time.Time) (*domain.LeaveRequest, error) {
	f.created = &domain.LeaveRequest{ID: "leave-1", EmployeeID: employeeID, LeaveType: leaveType, Reason: reason, StartDate: startDate, EndDate: endDate, Status: domain.LeaveStatusPending}
	return f.created, nil
}
func (f *fakeLeaveRepo) Get(context.Context, string) (*domain.LeaveRequest, error) {
	return f.getResult, f.getErr
}
func (f *fakeLeaveRepo) ListForEmployee(context.Context, string) ([]*domain.LeaveRequest, error) {
	return nil, nil
}
func (f *fakeLeaveRepo) ListAll(context.Context) ([]*domain.LeaveRequest, error) { return nil, nil }
func (f *fakeLeaveRepo) Decide(_ context.Context, id string, status domain.LeaveStatus, decidedBy, decidedFromIP string) (*domain.LeaveRequest, error) {
	f.decideCalls++
	f.decideStatus = status
	if f.decideErr != nil {
		return nil, f.decideErr
	}
	return &domain.LeaveRequest{ID: id, EmployeeID: "employee-1", Status: status, DecidedBy: &decidedBy}, nil
}

type fakeLeaveAttachmentRepo struct {
	created     *domain.LeaveAttachment
	createCalls int
	attachments map[string]*domain.LeaveAttachment
	listErr     error
}

func (f *fakeLeaveAttachmentRepo) Create(_ context.Context, leaveRequestID, uploadedBy, filename, contentType string, sizeBytes int64, file []byte) (*domain.LeaveAttachment, error) {
	f.createCalls++
	f.created = &domain.LeaveAttachment{
		ID: "attachment-1", LeaveRequestID: leaveRequestID, UploadedBy: uploadedBy,
		Filename: filename, ContentType: contentType, SizeBytes: sizeBytes, File: file,
	}
	return f.created, nil
}
func (f *fakeLeaveAttachmentRepo) ListForLeaveRequest(_ context.Context, leaveRequestID string) ([]*domain.LeaveAttachment, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	var out []*domain.LeaveAttachment
	for _, a := range f.attachments {
		if a.LeaveRequestID == leaveRequestID {
			out = append(out, a)
		}
	}
	return out, nil
}
func (f *fakeLeaveAttachmentRepo) Get(_ context.Context, id string) (*domain.LeaveAttachment, error) {
	if a, ok := f.attachments[id]; ok {
		return a, nil
	}
	return nil, domain.ErrLeaveAttachmentNotFound
}

type fakeAuditLogRepo struct {
	calls   int
	actorID string
	action  string
}

func (f *fakeAuditLogRepo) Create(_ context.Context, l *domain.AdminAuditLog) (*domain.AdminAuditLog, error) {
	f.calls++
	f.actorID = l.ActorID
	f.action = l.Action
	return l, nil
}
func (f *fakeAuditLogRepo) ListForTarget(context.Context, string, string) ([]*domain.AdminAuditLog, error) {
	return nil, nil
}

func TestLeaveUsecase_Create_RejectsBadDateOrder(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, &fakeLeaveAttachmentRepo{}, audit, &fakeRiverInsertClient{})

	start := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 5, 0, 0, 0, 0, time.UTC) // before start

	_, err := uc.Create(context.Background(), "employee-1", nil, nil, start, end)
	require.ErrorIs(t, err, usecase.ErrLeaveDateOrder)
	require.Nil(t, leaves.created, "must not reach the repository with bad dates")
}

func TestLeaveUsecase_Create_Success(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, &fakeLeaveAttachmentRepo{}, audit, &fakeRiverInsertClient{})

	start := time.Date(2026, 6, 5, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)

	created, err := uc.Create(context.Background(), "employee-1", nil, nil, start, end)
	require.NoError(t, err)
	require.Equal(t, "employee-1", created.EmployeeID)
}

func TestLeaveUsecase_Decide_LogsAuditEntry(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	auditRepo := &fakeAuditLogRepo{}
	audit := usecase.NewAuditLogUsecase(auditRepo)
	riverClient := &fakeRiverInsertClient{}
	uc := usecase.NewLeaveUsecase(leaves, &fakeLeaveAttachmentRepo{}, audit, riverClient)

	decided, err := uc.Decide(context.Background(), "leave-1", domain.LeaveStatusApproved, "admin-1", "127.0.0.1")
	require.NoError(t, err)
	require.Equal(t, domain.LeaveStatusApproved, decided.Status)
	require.Equal(t, 1, leaves.decideCalls)

	require.Equal(t, 1, auditRepo.calls, "a decision must write an audit log entry — PR 4's AuditLogUsecase's first real consumer")
	require.Equal(t, "admin-1", auditRepo.actorID)
	require.Equal(t, "leave.decide", auditRepo.action)
}

func TestLeaveUsecase_Decide_EnqueuesNotificationJob(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	riverClient := &fakeRiverInsertClient{}
	uc := usecase.NewLeaveUsecase(leaves, &fakeLeaveAttachmentRepo{}, audit, riverClient)

	_, err := uc.Decide(context.Background(), "leave-1", domain.LeaveStatusApproved, "admin-1", "127.0.0.1")
	require.NoError(t, err)

	require.Len(t, riverClient.insertedArgs, 1, "a decision must enqueue a leave-decision notify job")
	require.Equal(t, jobs.LeaveDecisionNotifyArgs{LeaveRequestID: "leave-1"}, riverClient.insertedArgs[0])
}

func TestLeaveUsecase_Decide_PropagatesRepoError(t *testing.T) {
	leaves := &fakeLeaveRepo{decideErr: domain.ErrLeaveRequestAlreadyDecided}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, &fakeLeaveAttachmentRepo{}, audit, &fakeRiverInsertClient{})

	_, err := uc.Decide(context.Background(), "leave-1", domain.LeaveStatusRejected, "admin-1", "127.0.0.1")
	require.ErrorIs(t, err, domain.ErrLeaveRequestAlreadyDecided)
}

func TestLeaveUsecase_UploadAttachment_RejectsTooLarge(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	attachments := &fakeLeaveAttachmentRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	_, err := uc.UploadAttachment(context.Background(), "leave-1", "employee-1", "big.png", "image/png", domain.MaxLeaveAttachmentBytes+1, nil)
	require.ErrorIs(t, err, domain.ErrLeaveAttachmentTooLarge)
	require.Equal(t, 0, attachments.createCalls, "must reject before ever reaching the repository")
}

func TestLeaveUsecase_UploadAttachment_RejectsUnsupportedType(t *testing.T) {
	leaves := &fakeLeaveRepo{}
	attachments := &fakeLeaveAttachmentRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	_, err := uc.UploadAttachment(context.Background(), "leave-1", "employee-1", "malware.exe", "application/octet-stream", 100, []byte("x"))
	require.ErrorIs(t, err, domain.ErrLeaveAttachmentUnsupportedType)
	require.Equal(t, 0, attachments.createCalls)
}

func TestLeaveUsecase_UploadAttachment_RejectsNonOwner(t *testing.T) {
	leaves := &fakeLeaveRepo{getResult: &domain.LeaveRequest{ID: "leave-1", EmployeeID: "employee-1"}}
	attachments := &fakeLeaveAttachmentRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	// "employee-2" tries to attach a file to "employee-1"'s leave request.
	_, err := uc.UploadAttachment(context.Background(), "leave-1", "employee-2", "note.pdf", "application/pdf", 100, []byte("x"))
	require.ErrorIs(t, err, domain.ErrLeaveAttachmentForbidden)
	require.Equal(t, 0, attachments.createCalls)
}

func TestLeaveUsecase_UploadAttachment_Success(t *testing.T) {
	leaves := &fakeLeaveRepo{getResult: &domain.LeaveRequest{ID: "leave-1", EmployeeID: "employee-1"}}
	attachments := &fakeLeaveAttachmentRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	created, err := uc.UploadAttachment(context.Background(), "leave-1", "employee-1", "note.pdf", "application/pdf", 4, []byte("test"))
	require.NoError(t, err)
	require.Equal(t, "note.pdf", created.Filename)
	require.Equal(t, 1, attachments.createCalls)
}

func TestLeaveUsecase_ListAttachments_OwnerAllowed(t *testing.T) {
	leaves := &fakeLeaveRepo{getResult: &domain.LeaveRequest{ID: "leave-1", EmployeeID: "employee-1"}}
	attachments := &fakeLeaveAttachmentRepo{
		attachments: map[string]*domain.LeaveAttachment{
			"attachment-1": {ID: "attachment-1", LeaveRequestID: "leave-1"},
		},
	}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	rows, err := uc.ListAttachments(context.Background(), "leave-1", "employee-1", domain.RoleEmployee)
	require.NoError(t, err)
	require.Len(t, rows, 1)
}

func TestLeaveUsecase_ListAttachments_AdminAllowedWithoutOwning(t *testing.T) {
	leaves := &fakeLeaveRepo{getResult: &domain.LeaveRequest{ID: "leave-1", EmployeeID: "employee-1"}}
	attachments := &fakeLeaveAttachmentRepo{
		attachments: map[string]*domain.LeaveAttachment{
			"attachment-1": {ID: "attachment-1", LeaveRequestID: "leave-1"},
		},
	}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	rows, err := uc.ListAttachments(context.Background(), "leave-1", "admin-1", domain.RoleAdmin)
	require.NoError(t, err)
	require.Len(t, rows, 1)
}

func TestLeaveUsecase_ListAttachments_OtherEmployeeForbidden(t *testing.T) {
	leaves := &fakeLeaveRepo{getResult: &domain.LeaveRequest{ID: "leave-1", EmployeeID: "employee-1"}}
	attachments := &fakeLeaveAttachmentRepo{}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	_, err := uc.ListAttachments(context.Background(), "leave-1", "employee-2", domain.RoleEmployee)
	require.ErrorIs(t, err, domain.ErrLeaveAttachmentForbidden)
}

func TestLeaveUsecase_GetAttachment_RejectsMismatchedLeaveRequest(t *testing.T) {
	leaves := &fakeLeaveRepo{getResult: &domain.LeaveRequest{ID: "leave-1", EmployeeID: "employee-1"}}
	attachments := &fakeLeaveAttachmentRepo{
		attachments: map[string]*domain.LeaveAttachment{
			// Belongs to a different leave request than the one requested.
			"attachment-1": {ID: "attachment-1", LeaveRequestID: "leave-999"},
		},
	}
	audit := usecase.NewAuditLogUsecase(&fakeAuditLogRepo{})
	uc := usecase.NewLeaveUsecase(leaves, attachments, audit, &fakeRiverInsertClient{})

	_, err := uc.GetAttachment(context.Background(), "leave-1", "attachment-1", "employee-1", domain.RoleEmployee)
	require.ErrorIs(t, err, domain.ErrLeaveAttachmentNotFound)
}

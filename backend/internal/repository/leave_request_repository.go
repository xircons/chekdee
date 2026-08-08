package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/repository/sqlcgen"
)

type LeaveRequestRepository struct {
	q *sqlcgen.Queries
}

func NewLeaveRequestRepository(pool *pgxpool.Pool) *LeaveRequestRepository {
	return &LeaveRequestRepository{q: sqlcgen.New(pool)}
}

func toLeaveRequest(l sqlcgen.LeaveRequest) *domain.LeaveRequest {
	return &domain.LeaveRequest{
		ID:                     uuidToString(l.ID),
		EmployeeID:             uuidToString(l.EmployeeID),
		StartDate:              dateToTime(l.StartDate),
		EndDate:                dateToTime(l.EndDate),
		Reason:                 textToStringPtr(l.Reason),
		Status:                 domain.LeaveStatus(l.Status),
		ApprovalTokenHash:      textToStringPtr(l.ApprovalTokenHash),
		ApprovalTokenExpiresAt: timestamptzToTimePtr(l.ApprovalTokenExpiresAt),
		DecidedBy:              uuidToStringPtr(l.DecidedBy),
		DecidedAt:              timestamptzToTimePtr(l.DecidedAt),
		DecidedFromIP:          textToStringPtr(l.DecidedFromIp),
		CreatedAt:              timestamptzToTime(l.CreatedAt),
		UpdatedAt:              timestamptzToTime(l.UpdatedAt),
	}
}

func (r *LeaveRequestRepository) Create(ctx context.Context, lr *domain.LeaveRequest) (*domain.LeaveRequest, error) {
	row, err := r.q.CreateLeaveRequest(ctx, sqlcgen.CreateLeaveRequestParams{
		EmployeeID:             stringToUUID(lr.EmployeeID),
		StartDate:              timeToDate(lr.StartDate),
		EndDate:                timeToDate(lr.EndDate),
		Reason:                 stringPtrToText(lr.Reason),
		ApprovalTokenHash:      stringPtrToText(lr.ApprovalTokenHash),
		ApprovalTokenExpiresAt: timePtrToTimestamptz(lr.ApprovalTokenExpiresAt),
	})
	if err != nil {
		return nil, err
	}
	return toLeaveRequest(row), nil
}

func (r *LeaveRequestRepository) GetByApprovalTokenHash(ctx context.Context, tokenHash string) (*domain.LeaveRequest, error) {
	row, err := r.q.GetLeaveRequestByApprovalTokenHash(ctx, stringToText(tokenHash))
	if err != nil {
		return nil, mapNoRows(err, domain.ErrLeaveRequestNotFound)
	}
	return toLeaveRequest(row), nil
}

func (r *LeaveRequestRepository) GetByID(ctx context.Context, id string) (*domain.LeaveRequest, error) {
	row, err := r.q.GetLeaveRequestByID(ctx, stringToUUID(id))
	if err != nil {
		return nil, mapNoRows(err, domain.ErrLeaveRequestNotFound)
	}
	return toLeaveRequest(row), nil
}

func (r *LeaveRequestRepository) Decide(ctx context.Context, id string, status domain.LeaveStatus, decidedBy, decidedFromIP string) (*domain.LeaveRequest, error) {
	row, err := r.q.DecideLeaveRequest(ctx, sqlcgen.DecideLeaveRequestParams{
		ID:            stringToUUID(id),
		Status:        sqlcgen.LeaveStatus(status),
		DecidedBy:     stringToUUID(decidedBy),
		DecidedFromIp: stringToText(decidedFromIP),
	})
	if err != nil {
		return nil, err
	}
	return toLeaveRequest(row), nil
}

func (r *LeaveRequestRepository) ListForEmployee(ctx context.Context, employeeID string) ([]*domain.LeaveRequest, error) {
	rows, err := r.q.ListLeaveRequestsForEmployee(ctx, stringToUUID(employeeID))
	if err != nil {
		return nil, err
	}
	out := make([]*domain.LeaveRequest, 0, len(rows))
	for _, row := range rows {
		out = append(out, toLeaveRequest(row))
	}
	return out, nil
}

func (r *LeaveRequestRepository) ListPendingOlderThan(ctx context.Context, createdBefore time.Time) ([]*domain.LeaveRequest, error) {
	rows, err := r.q.ListPendingLeaveRequestsOlderThan(ctx, timeToTimestamptz(createdBefore))
	if err != nil {
		return nil, err
	}
	out := make([]*domain.LeaveRequest, 0, len(rows))
	for _, row := range rows {
		out = append(out, toLeaveRequest(row))
	}
	return out, nil
}

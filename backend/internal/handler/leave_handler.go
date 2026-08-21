package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type LeaveHandler struct {
	leaves *usecase.LeaveUsecase
}

func NewLeaveHandler(leaves *usecase.LeaveUsecase) *LeaveHandler {
	return &LeaveHandler{leaves: leaves}
}

type leaveRequestView struct {
	ID         string  `json:"id"`
	EmployeeID string  `json:"employee_id"`
	LeaveType  *string `json:"leave_type"`
	StartDate  string  `json:"start_date"`
	EndDate    string  `json:"end_date"`
	Reason     *string `json:"reason"`
	Status     string  `json:"status"`
	DecidedBy  *string `json:"decided_by"`
	DecidedAt  *string `json:"decided_at"`
	CreatedAt  string  `json:"created_at"`
}

func toLeaveRequestView(l *domain.LeaveRequest) leaveRequestView {
	v := leaveRequestView{
		ID: l.ID, EmployeeID: l.EmployeeID, LeaveType: l.LeaveType,
		StartDate: l.StartDate.Format(dateLayout), EndDate: l.EndDate.Format(dateLayout),
		Reason: l.Reason, Status: string(l.Status), DecidedBy: l.DecidedBy,
		CreatedAt: l.CreatedAt.Format(time.RFC3339),
	}
	if l.DecidedAt != nil {
		s := l.DecidedAt.Format(time.RFC3339)
		v.DecidedAt = &s
	}
	return v
}

func toLeaveRequestViews(rows []*domain.LeaveRequest) []leaveRequestView {
	out := make([]leaveRequestView, 0, len(rows))
	for _, l := range rows {
		out = append(out, toLeaveRequestView(l))
	}
	return out
}

type createLeaveRequestRequest struct {
	LeaveType string `json:"leave_type"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	Reason    string `json:"reason"`
}

// Create submits a leave request for the authenticated employee. Mounted
// behind RequireAuth — any authenticated user submits for themselves.
func (h *LeaveHandler) Create(c echo.Context) error {
	var req createLeaveRequestRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	startDate, err := time.Parse(dateLayout, req.StartDate)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "start_date ไม่ถูกต้อง รูปแบบที่ถูกต้องคือ YYYY-MM-DD")
	}
	endDate, err := time.Parse(dateLayout, req.EndDate)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "end_date ไม่ถูกต้อง รูปแบบที่ถูกต้องคือ YYYY-MM-DD")
	}

	var leaveType, reason *string
	if req.LeaveType != "" {
		leaveType = &req.LeaveType
	}
	if req.Reason != "" {
		reason = &req.Reason
	}

	created, err := h.leaves.Create(c.Request().Context(), userIDFromContext(c), leaveType, reason, startDate, endDate)
	if errors.Is(err, usecase.ErrLeaveDateOrder) {
		return echo.NewHTTPError(http.StatusBadRequest, "end_date ต้องไม่มาก่อน start_date")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "สร้างคำขอลาไม่สำเร็จ")
	}
	return c.JSON(http.StatusCreated, toLeaveRequestView(created))
}

// Me returns the authenticated employee's own leave requests. Mounted
// behind RequireAuth.
func (h *LeaveHandler) Me(c echo.Context) error {
	rows, err := h.leaves.ListForEmployee(c.Request().Context(), userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดคำขอลาไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toLeaveRequestViews(rows))
}

// List is the admin org-wide view, pending first. Mounted behind RequireRole.
func (h *LeaveHandler) List(c echo.Context) error {
	rows, err := h.leaves.ListAll(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดคำขอลาไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toLeaveRequestViews(rows))
}

func (h *LeaveHandler) decide(c echo.Context, status domain.LeaveStatus) error {
	decided, err := h.leaves.Decide(c.Request().Context(), c.Param("id"), status, userIDFromContext(c), c.RealIP())
	switch {
	case errors.Is(err, domain.ErrLeaveRequestNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบคำขอลา")
	case errors.Is(err, domain.ErrLeaveRequestAlreadyDecided):
		return echo.NewHTTPError(http.StatusConflict, "คำขอลานี้ถูกพิจารณาแล้ว")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "พิจารณาคำขอลาไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toLeaveRequestView(decided))
}

// Approve is in-app only — see PLAN.md's locked-in decision, no email
// approval link. Mounted behind RequireRole.
func (h *LeaveHandler) Approve(c echo.Context) error {
	return h.decide(c, domain.LeaveStatusApproved)
}

// Reject is in-app only, same as Approve. Mounted behind RequireRole.
func (h *LeaveHandler) Reject(c echo.Context) error {
	return h.decide(c, domain.LeaveStatusRejected)
}

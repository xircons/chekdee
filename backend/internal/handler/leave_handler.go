package handler

import (
	"errors"
	"io"
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

type leaveAttachmentView struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	CreatedAt   string `json:"created_at"`
}

func toLeaveAttachmentView(a *domain.LeaveAttachment) leaveAttachmentView {
	return leaveAttachmentView{
		ID:          a.ID,
		Filename:    a.Filename,
		ContentType: a.ContentType,
		SizeBytes:   a.SizeBytes,
		CreatedAt:   a.CreatedAt.Format(time.RFC3339),
	}
}

func toLeaveAttachmentViews(rows []*domain.LeaveAttachment) []leaveAttachmentView {
	out := make([]leaveAttachmentView, 0, len(rows))
	for _, a := range rows {
		out = append(out, toLeaveAttachmentView(a))
	}
	return out
}

// UploadAttachment attaches a supporting PNG/JPEG/PDF file to the caller's
// own leave request. Mounted behind RequireAuth, no RequireRole — the
// usecase itself checks the caller owns the leave request (see
// LeaveUsecase.UploadAttachment).
func (h *LeaveHandler) UploadAttachment(c echo.Context) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องแนบไฟล์")
	}
	src, err := fileHeader.Open()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "เปิดไฟล์ไม่สำเร็จ")
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "อ่านไฟล์ไม่สำเร็จ")
	}

	created, err := h.leaves.UploadAttachment(
		c.Request().Context(), c.Param("id"), userIDFromContext(c),
		fileHeader.Filename, fileHeader.Header.Get(echo.HeaderContentType), fileHeader.Size, data,
	)
	switch {
	case errors.Is(err, domain.ErrLeaveAttachmentTooLarge):
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "ไฟล์มีขนาดใหญ่เกินไป ขนาดสูงสุดคือ 10MB")
	case errors.Is(err, domain.ErrLeaveAttachmentUnsupportedType):
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, "รองรับเฉพาะไฟล์ PNG, JPEG หรือ PDF เท่านั้น")
	case errors.Is(err, domain.ErrLeaveAttachmentForbidden):
		return echo.NewHTTPError(http.StatusForbidden, "สิทธิ์ไม่เพียงพอ")
	case errors.Is(err, domain.ErrLeaveRequestNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบคำขอลา")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "แนบไฟล์ไม่สำเร็จ")
	}
	return c.JSON(http.StatusCreated, toLeaveAttachmentView(created))
}

// ListAttachments returns metadata (not file bytes) for every attachment on
// a leave request. Mounted behind RequireAuth — the usecase allows either
// an admin-role caller or the leave request's own employee.
func (h *LeaveHandler) ListAttachments(c echo.Context) error {
	rows, err := h.leaves.ListAttachments(c.Request().Context(), c.Param("id"), userIDFromContext(c), roleFromContext(c))
	switch {
	case errors.Is(err, domain.ErrLeaveAttachmentForbidden):
		return echo.NewHTTPError(http.StatusForbidden, "สิทธิ์ไม่เพียงพอ")
	case errors.Is(err, domain.ErrLeaveRequestNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบคำขอลา")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดไฟล์แนบไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toLeaveAttachmentViews(rows))
}

// DownloadAttachment streams one attachment's raw bytes. Same access rule
// as ListAttachments. inline (not attachment) Content-Disposition -- PNG/
// PDF attachments are meant to be previewed, not force-downloaded.
func (h *LeaveHandler) DownloadAttachment(c echo.Context) error {
	attachment, err := h.leaves.GetAttachment(
		c.Request().Context(), c.Param("id"), c.Param("attachmentId"), userIDFromContext(c), roleFromContext(c),
	)
	switch {
	case errors.Is(err, domain.ErrLeaveAttachmentForbidden):
		return echo.NewHTTPError(http.StatusForbidden, "สิทธิ์ไม่เพียงพอ")
	case errors.Is(err, domain.ErrLeaveAttachmentNotFound), errors.Is(err, domain.ErrLeaveRequestNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบไฟล์แนบ")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดไฟล์แนบไม่สำเร็จ")
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, `inline; filename="`+attachment.Filename+`"`)
	return c.Blob(http.StatusOK, attachment.ContentType, attachment.File)
}

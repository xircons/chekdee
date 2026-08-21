package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type NotificationHandler struct {
	notifications *usecase.NotificationUsecase
}

func NewNotificationHandler(notifications *usecase.NotificationUsecase) *NotificationHandler {
	return &NotificationHandler{notifications: notifications}
}

type notificationView struct {
	ID        string  `json:"id"`
	Type      string  `json:"type"`
	Title     string  `json:"title"`
	Body      *string `json:"body"`
	ReadAt    *string `json:"read_at"`
	CreatedAt string  `json:"created_at"`
}

func toNotificationView(n *domain.Notification) notificationView {
	v := notificationView{
		ID: n.ID, Type: n.Type, Title: n.Title, Body: n.Body,
		CreatedAt: n.CreatedAt.Format(time.RFC3339),
	}
	if n.ReadAt != nil {
		s := n.ReadAt.Format(time.RFC3339)
		v.ReadAt = &s
	}
	return v
}

// Me returns the authenticated user's own notifications, most recent first
// — optionally unread-only via ?unread=true. Mounted behind RequireAuth.
func (h *NotificationHandler) Me(c echo.Context) error {
	unreadOnly := c.QueryParam("unread") == "true"
	rows, err := h.notifications.ListForRecipient(c.Request().Context(), userIDFromContext(c), unreadOnly)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดการแจ้งเตือนไม่สำเร็จ")
	}
	out := make([]notificationView, 0, len(rows))
	for _, n := range rows {
		out = append(out, toNotificationView(n))
	}
	return c.JSON(http.StatusOK, out)
}

// MarkRead marks one of the authenticated user's own notifications read.
// Mounted behind RequireAuth.
func (h *NotificationHandler) MarkRead(c echo.Context) error {
	err := h.notifications.MarkRead(c.Request().Context(), c.Param("id"), userIDFromContext(c))
	if errors.Is(err, domain.ErrNotificationNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบการแจ้งเตือน")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ")
	}
	return c.NoContent(http.StatusNoContent)
}

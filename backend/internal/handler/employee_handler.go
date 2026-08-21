package handler

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

// uuidPattern validates team_id query params before they reach SQL — a
// malformed value bound against team_id::uuid would otherwise surface as
// an unpredictable driver error instead of a clean 400.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type EmployeeHandler struct {
	employees *usecase.EmployeeUsecase
}

func NewEmployeeHandler(employees *usecase.EmployeeUsecase) *EmployeeHandler {
	return &EmployeeHandler{employees: employees}
}

// employeeView deliberately excludes username, password_hash, and
// line_user_id — those are internal auth fields, not directory data.
type employeeView struct {
	ID                      string  `json:"id"`
	Role                    string  `json:"role"`
	Status                  string  `json:"status"`
	TeamID                  *string `json:"team_id"`
	FirstName               *string `json:"first_name"`
	LastName                *string `json:"last_name"`
	StudentGen              *string `json:"student_gen"`
	StudentID               *string `json:"student_id"`
	PhoneNumber             *string `json:"phone_number"`
	Project                 *string `json:"project"`
	Email                   *string `json:"email"`
	LineDisplayName         *string `json:"line_display_name"`
	LinePictureURL          *string `json:"line_picture_url"`
	RegistrationCompletedAt *string `json:"registration_completed_at"`
	OffboardedAt            *string `json:"offboarded_at"`
	OffboardedReason        *string `json:"offboarded_reason"`
	CreatedAt               string  `json:"created_at"`
}

func toEmployeeView(u *domain.User) employeeView {
	v := employeeView{
		ID:               u.ID,
		Role:             string(u.Role),
		Status:           string(u.Status),
		TeamID:           u.TeamID,
		FirstName:        u.FirstName,
		LastName:         u.LastName,
		StudentGen:       u.StudentGen,
		StudentID:        u.StudentID,
		PhoneNumber:      u.PhoneNumber,
		Project:          u.Project,
		Email:            u.Email,
		LineDisplayName:  u.LineDisplayName,
		LinePictureURL:   u.LinePictureURL,
		OffboardedReason: u.OffboardedReason,
		CreatedAt:        u.CreatedAt.Format(time.RFC3339),
	}
	if u.RegistrationCompletedAt != nil {
		s := u.RegistrationCompletedAt.Format(time.RFC3339)
		v.RegistrationCompletedAt = &s
	}
	if u.OffboardedAt != nil {
		s := u.OffboardedAt.Format(time.RFC3339)
		v.OffboardedAt = &s
	}
	return v
}

func toEmployeeViews(rows []*domain.User) []employeeView {
	out := make([]employeeView, 0, len(rows))
	for _, u := range rows {
		out = append(out, toEmployeeView(u))
	}
	return out
}

type employeeListResponse struct {
	Employees []employeeView `json:"employees"`
	Total     int            `json:"total"`
}

// queryStringPtr returns nil for an absent/empty query param, matching the
// domain.EmployeeListFilter's "nil/empty means unfiltered" convention.
func queryStringPtr(c echo.Context, name string) *string {
	if v := c.QueryParam(name); v != "" {
		return &v
	}
	return nil
}

func queryInt(c echo.Context, name string) int {
	n, err := strconv.Atoi(c.QueryParam(name))
	if err != nil {
		return 0
	}
	return n
}

// List is the employee directory. Mounted behind RequireRole.
func (h *EmployeeHandler) List(c echo.Context) error {
	teamID := queryStringPtr(c, "team_id")
	if teamID != nil && !uuidPattern.MatchString(*teamID) {
		return echo.NewHTTPError(http.StatusBadRequest, "team_id ไม่ถูกต้อง")
	}

	status := queryStringPtr(c, "status")
	if status != nil && *status != "active" && *status != "offboarded" {
		return echo.NewHTTPError(http.StatusBadRequest, "สถานะไม่ถูกต้อง ต้องเป็น active หรือ offboarded")
	}

	filter := domain.EmployeeListFilter{
		TeamID:         teamID,
		OffboardStatus: status,
		Search:         c.QueryParam("search"),
		Limit:          queryInt(c, "limit"),
		Offset:         queryInt(c, "offset"),
	}
	if roleParam := c.QueryParam("role"); roleParam != "" {
		role := domain.Role(roleParam)
		filter.Role = &role
	}

	rows, total, err := h.employees.List(c.Request().Context(), filter)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดรายชื่อพนักงานไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, employeeListResponse{Employees: toEmployeeViews(rows), Total: total})
}

// Get returns one employee. Mounted behind RequireRole.
func (h *EmployeeHandler) Get(c echo.Context) error {
	u, err := h.employees.GetByID(c.Request().Context(), c.Param("id"))
	if errors.Is(err, domain.ErrUserNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบพนักงาน")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดข้อมูลพนักงานไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toEmployeeView(u))
}

type updateEmployeeRequest struct {
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	TeamID      *string `json:"team_id"`
	StudentGen  *string `json:"student_gen"`
	StudentID   *string `json:"student_id"`
	PhoneNumber *string `json:"phone_number"`
	Project     *string `json:"project"`
	Email       *string `json:"email"`
}

// Update edits profile fields only. Mounted behind RequireRole.
func (h *EmployeeHandler) Update(c echo.Context) error {
	var req updateEmployeeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.FirstName == "" || req.LastName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุชื่อและนามสกุล")
	}

	updated, err := h.employees.Update(c.Request().Context(), userIDFromContext(c), c.Param("id"), &req.FirstName, &req.LastName, req.TeamID, req.StudentGen, req.StudentID, req.PhoneNumber, req.Project, req.Email)
	if errors.Is(err, domain.ErrUserNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบพนักงาน")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "แก้ไขข้อมูลพนักงานไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toEmployeeView(updated))
}

type updateEmployeeRoleRequest struct {
	Role string `json:"role"`
}

// isKnownRole accepts every domain.Role value, including system_owner —
// an unknown string (typo, empty, garbage) is a 400 here; a syntactically
// valid but disallowed value like "system_owner" is left to flow through
// to the usecase, which already returns a more specific 403 for it.
func isKnownRole(role string) bool {
	switch domain.Role(role) {
	case domain.RoleEmployee, domain.RoleSupervisor, domain.RoleAdmin, domain.RoleSystemOwner:
		return true
	}
	return false
}

// UpdateRole changes a user's role — a distinct, more sensitive action from
// Update, with its own audit-log entry. Mounted behind RequireRole.
func (h *EmployeeHandler) UpdateRole(c echo.Context) error {
	var req updateEmployeeRoleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.Role == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุตำแหน่ง")
	}
	if !isKnownRole(req.Role) {
		return echo.NewHTTPError(http.StatusBadRequest, "ตำแหน่งไม่ถูกต้อง")
	}

	updated, err := h.employees.UpdateRole(c.Request().Context(), userIDFromContext(c), c.Param("id"), domain.Role(req.Role))
	switch {
	case errors.Is(err, domain.ErrCannotModifySystemOwnerRole):
		return echo.NewHTTPError(http.StatusForbidden, "ไม่สามารถเปลี่ยนตำแหน่งเป็นหรือจาก system_owner ได้")
	case errors.Is(err, domain.ErrInsufficientRole):
		return echo.NewHTTPError(http.StatusForbidden, "สิทธิ์ไม่เพียงพอสำหรับการเปลี่ยนแปลงนี้")
	case errors.Is(err, domain.ErrUserNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบพนักงาน")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "เปลี่ยนตำแหน่งไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toEmployeeView(updated))
}

type offboardEmployeeRequest struct {
	Reason string `json:"reason"`
}

// Offboard soft-deletes a user. Mounted behind RequireRole.
func (h *EmployeeHandler) Offboard(c echo.Context) error {
	var req offboardEmployeeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}

	var reason *string
	if req.Reason != "" {
		reason = &req.Reason
	}

	offboarded, err := h.employees.Offboard(c.Request().Context(), userIDFromContext(c), c.Param("id"), reason)
	switch {
	case errors.Is(err, domain.ErrCannotOffboardSystemOwner):
		return echo.NewHTTPError(http.StatusForbidden, "ไม่สามารถให้ system_owner พ้นสภาพได้")
	case errors.Is(err, domain.ErrInsufficientRole):
		return echo.NewHTTPError(http.StatusForbidden, "สิทธิ์ไม่เพียงพอสำหรับการให้พนักงานคนนี้พ้นสภาพ")
	case errors.Is(err, domain.ErrUserNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบพนักงาน")
	case errors.Is(err, domain.ErrUserAlreadyOffboarded):
		return echo.NewHTTPError(http.StatusConflict, "พนักงานพ้นสภาพไปแล้ว")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "ให้พนักงานพ้นสภาพไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toEmployeeView(offboarded))
}

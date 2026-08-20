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
		return echo.NewHTTPError(http.StatusBadRequest, "invalid team_id")
	}

	status := queryStringPtr(c, "status")
	if status != nil && *status != "active" && *status != "offboarded" {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid status, expected active or offboarded")
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
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load employees")
	}
	return c.JSON(http.StatusOK, employeeListResponse{Employees: toEmployeeViews(rows), Total: total})
}

// Get returns one employee. Mounted behind RequireRole.
func (h *EmployeeHandler) Get(c echo.Context) error {
	u, err := h.employees.GetByID(c.Request().Context(), c.Param("id"))
	if errors.Is(err, domain.ErrUserNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "employee not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load employee")
	}
	return c.JSON(http.StatusOK, toEmployeeView(u))
}

type updateEmployeeRequest struct {
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	TeamID    *string `json:"team_id"`
}

// Update edits profile fields only. Mounted behind RequireRole.
func (h *EmployeeHandler) Update(c echo.Context) error {
	var req updateEmployeeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.FirstName == "" || req.LastName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "first_name and last_name are required")
	}

	updated, err := h.employees.Update(c.Request().Context(), userIDFromContext(c), c.Param("id"), &req.FirstName, &req.LastName, req.TeamID)
	if errors.Is(err, domain.ErrUserNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "employee not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update employee")
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
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Role == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "role is required")
	}
	if !isKnownRole(req.Role) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid role")
	}

	updated, err := h.employees.UpdateRole(c.Request().Context(), userIDFromContext(c), c.Param("id"), domain.Role(req.Role))
	switch {
	case errors.Is(err, domain.ErrCannotModifySystemOwnerRole):
		return echo.NewHTTPError(http.StatusForbidden, "cannot change role to or from system_owner")
	case errors.Is(err, domain.ErrInsufficientRole):
		return echo.NewHTTPError(http.StatusForbidden, "insufficient role to make this change")
	case errors.Is(err, domain.ErrUserNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "employee not found")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update role")
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
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var reason *string
	if req.Reason != "" {
		reason = &req.Reason
	}

	offboarded, err := h.employees.Offboard(c.Request().Context(), userIDFromContext(c), c.Param("id"), reason)
	switch {
	case errors.Is(err, domain.ErrCannotOffboardSystemOwner):
		return echo.NewHTTPError(http.StatusForbidden, "cannot offboard system_owner")
	case errors.Is(err, domain.ErrInsufficientRole):
		return echo.NewHTTPError(http.StatusForbidden, "insufficient role to offboard this employee")
	case errors.Is(err, domain.ErrUserNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "employee not found")
	case errors.Is(err, domain.ErrUserAlreadyOffboarded):
		return echo.NewHTTPError(http.StatusConflict, "employee already offboarded")
	case err != nil:
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to offboard employee")
	}
	return c.JSON(http.StatusOK, toEmployeeView(offboarded))
}

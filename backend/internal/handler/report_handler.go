package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type ReportHandler struct {
	reports *usecase.ReportUsecase
	exports *usecase.ReportExportUsecase
}

func NewReportHandler(reports *usecase.ReportUsecase, exports *usecase.ReportExportUsecase) *ReportHandler {
	return &ReportHandler{reports: reports, exports: exports}
}

type monthlyReportRowView struct {
	EmployeeID  string  `json:"employee_id"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	WorkDays    int     `json:"work_days"`
	LateCount   int     `json:"late_count"`
	LateMinutes int     `json:"late_minutes"`
	AbsentCount int     `json:"absent_count"`
	LeaveDays   int     `json:"leave_days"`
	WorkedHours float64 `json:"worked_hours"`
}

func toMonthlyReportRowView(r domain.MonthlyReportRow) monthlyReportRowView {
	return monthlyReportRowView{
		EmployeeID: r.EmployeeID, FirstName: r.FirstName, LastName: r.LastName,
		WorkDays: r.WorkDays, LateCount: r.LateCount, LateMinutes: r.LateMinutes,
		AbsentCount: r.AbsentCount, LeaveDays: r.LeaveDays, WorkedHours: r.WorkedHours,
	}
}

// Monthly returns the org-wide monthly summary — the admin's live summary
// table. Mounted behind RequireRole.
func (h *ReportHandler) Monthly(c echo.Context) error {
	month := c.QueryParam("month")
	if month == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month is required, expected YYYY-MM")
	}

	rows, err := h.reports.MonthlyReport(c.Request().Context(), month)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid month or failed to load report")
	}

	out := make([]monthlyReportRowView, 0, len(rows))
	for _, r := range rows {
		out = append(out, toMonthlyReportRowView(r))
	}
	return c.JSON(http.StatusOK, out)
}

type dailyLogRowView struct {
	Date       string  `json:"date"`
	EmployeeID string  `json:"employee_id"`
	FirstName  *string `json:"first_name"`
	LastName   *string `json:"last_name"`
	Status     string  `json:"status"`
	CheckInAt  *string `json:"check_in_at"`
	CheckOutAt *string `json:"check_out_at"`
	AutoClosed bool    `json:"auto_closed"`
}

func toDailyLogRowView(r domain.DailyLogRow) dailyLogRowView {
	v := dailyLogRowView{
		Date: r.Date.Format(dateLayout), EmployeeID: r.EmployeeID,
		FirstName: r.FirstName, LastName: r.LastName,
		Status: string(r.Status), AutoClosed: r.AutoClosed,
	}
	if r.CheckInAt != nil {
		s := r.CheckInAt.Format(timeOfDayLayout)
		v.CheckInAt = &s
	}
	if r.CheckOutAt != nil {
		s := r.CheckOutAt.Format(timeOfDayLayout)
		v.CheckOutAt = &s
	}
	return v
}

// DailyLog backs the calendar-heatmap / daily detail view — org-wide, or
// scoped to one employee via ?employee_id=. Mounted behind RequireRole.
func (h *ReportHandler) DailyLog(c echo.Context) error {
	month := c.QueryParam("month")
	if month == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month is required, expected YYYY-MM")
	}
	var employeeID *string
	if v := c.QueryParam("employee_id"); v != "" {
		employeeID = &v
	}

	rows, err := h.reports.DailyLog(c.Request().Context(), month, employeeID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid month or failed to load daily log")
	}

	out := make([]dailyLogRowView, 0, len(rows))
	for _, r := range rows {
		out = append(out, toDailyLogRowView(r))
	}
	return c.JSON(http.StatusOK, out)
}

// MyDailyLog is the employee-scoped read DailyLog above has no equivalent
// of: any authenticated employee's own daily log, always forced to their
// own id regardless of query params, so there's no way to request someone
// else's. Mounted behind RequireAuth only, not RequireRole -- backs the
// employee home page's weekly attendance-history icons.
func (h *ReportHandler) MyDailyLog(c echo.Context) error {
	month := c.QueryParam("month")
	if month == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month is required, expected YYYY-MM")
	}
	employeeID := userIDFromContext(c)

	rows, err := h.reports.DailyLog(c.Request().Context(), month, &employeeID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid month or failed to load daily log")
	}

	out := make([]dailyLogRowView, 0, len(rows))
	for _, r := range rows {
		out = append(out, toDailyLogRowView(r))
	}
	return c.JSON(http.StatusOK, out)
}

type reportExportView struct {
	ID     string  `json:"id"`
	Month  string  `json:"month"`
	Status string  `json:"status"`
	Error  *string `json:"error"`
}

func toReportExportView(e *domain.ReportExport) reportExportView {
	return reportExportView{ID: e.ID, Month: e.Month, Status: string(e.Status), Error: e.Error}
}

type requestExportRequest struct {
	Month string `json:"month"`
}

// RequestExport enqueues an async Excel export — processing/ready/failed,
// no export history (v1). Mounted behind RequireRole.
func (h *ReportHandler) RequestExport(c echo.Context) error {
	var req requestExportRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Month == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month is required, expected YYYY-MM")
	}

	export, err := h.exports.RequestExport(c.Request().Context(), userIDFromContext(c), req.Month)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to start export")
	}
	return c.JSON(http.StatusAccepted, toReportExportView(export))
}

// GetExport polls export status. Mounted behind RequireRole.
func (h *ReportHandler) GetExport(c echo.Context) error {
	export, err := h.exports.GetExport(c.Request().Context(), c.Param("id"))
	if errors.Is(err, domain.ErrReportExportNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "export not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load export")
	}
	return c.JSON(http.StatusOK, toReportExportView(export))
}

// DownloadExport streams the finished .xlsx file. Mounted behind RequireRole.
func (h *ReportHandler) DownloadExport(c echo.Context) error {
	export, err := h.exports.GetExport(c.Request().Context(), c.Param("id"))
	if errors.Is(err, domain.ErrReportExportNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "export not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load export")
	}
	if export.Status != domain.ReportExportStatusReady {
		return echo.NewHTTPError(http.StatusConflict, "export is not ready")
	}

	filename := "attendance-report-" + export.Month + ".xlsx"
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="`+filename+`"`)
	return c.Blob(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", export.File)
}

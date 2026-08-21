package handler

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

const (
	timeOfDayLayout = "15:04:05"
	dateLayout      = "2006-01-02"
)

type ScheduleHandler struct {
	schedules *usecase.ScheduleUsecase
}

func NewScheduleHandler(schedules *usecase.ScheduleUsecase) *ScheduleHandler {
	return &ScheduleHandler{schedules: schedules}
}

type workScheduleView struct {
	ID            string  `json:"id"`
	EmployeeID    string  `json:"employee_id"`
	DayOfWeek     int16   `json:"day_of_week"`
	StartTime     string  `json:"start_time"`
	EndTime       string  `json:"end_time"`
	EffectiveFrom string  `json:"effective_from"`
	EffectiveTo   *string `json:"effective_to"`
}

func toWorkScheduleView(ws *domain.WorkSchedule) workScheduleView {
	v := workScheduleView{
		ID:            ws.ID,
		EmployeeID:    ws.EmployeeID,
		DayOfWeek:     ws.DayOfWeek,
		StartTime:     ws.StartTime.Format(timeOfDayLayout),
		EndTime:       ws.EndTime.Format(timeOfDayLayout),
		EffectiveFrom: ws.EffectiveFrom.Format(dateLayout),
	}
	if ws.EffectiveTo != nil {
		s := ws.EffectiveTo.Format(dateLayout)
		v.EffectiveTo = &s
	}
	return v
}

// Me returns the authenticated employee's own schedule. Any authenticated
// user can read their own schedule; no role restriction.
func (h *ScheduleHandler) Me(c echo.Context) error {
	rows, err := h.schedules.ListForEmployee(c.Request().Context(), userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดตารางเวลาไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toWorkScheduleViews(rows))
}

// ListForEmployee is the admin view of one employee's schedule. Mounted
// behind RequireRole — see handler.go.
func (h *ScheduleHandler) ListForEmployee(c echo.Context) error {
	rows, err := h.schedules.ListForEmployee(c.Request().Context(), c.Param("employeeId"))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "โหลดตารางเวลาไม่สำเร็จ")
	}
	return c.JSON(http.StatusOK, toWorkScheduleViews(rows))
}

func toWorkScheduleViews(rows []*domain.WorkSchedule) []workScheduleView {
	out := make([]workScheduleView, 0, len(rows))
	for _, ws := range rows {
		out = append(out, toWorkScheduleView(ws))
	}
	return out
}

type replaceScheduleRow struct {
	DayOfWeek     int16   `json:"day_of_week"`
	StartTime     string  `json:"start_time"`
	EndTime       string  `json:"end_time"`
	EffectiveFrom string  `json:"effective_from"`
	EffectiveTo   *string `json:"effective_to"`
}

type replaceScheduleRequest struct {
	Rows []replaceScheduleRow `json:"rows"`
}

// Replace swaps an employee's whole schedule for the given rows — the admin
// single-employee editor and CSV import both reduce to this one call.
// Mounted behind RequireRole — see handler.go.
func (h *ScheduleHandler) Replace(c echo.Context) error {
	employeeID := c.Param("employeeId")

	var req replaceScheduleRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}

	rows := make([]*domain.WorkSchedule, 0, len(req.Rows))
	for _, r := range req.Rows {
		startTime, err := time.Parse(timeOfDayLayout, r.StartTime)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "start_time ไม่ถูกต้อง รูปแบบที่ถูกต้องคือ HH:MM:SS")
		}
		endTime, err := time.Parse(timeOfDayLayout, r.EndTime)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "end_time ไม่ถูกต้อง รูปแบบที่ถูกต้องคือ HH:MM:SS")
		}
		effectiveFrom, err := time.Parse(dateLayout, r.EffectiveFrom)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "effective_from ไม่ถูกต้อง รูปแบบที่ถูกต้องคือ YYYY-MM-DD")
		}
		var effectiveTo *time.Time
		if r.EffectiveTo != nil {
			t, err := time.Parse(dateLayout, *r.EffectiveTo)
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, "effective_to ไม่ถูกต้อง รูปแบบที่ถูกต้องคือ YYYY-MM-DD")
			}
			effectiveTo = &t
		}

		rows = append(rows, &domain.WorkSchedule{
			DayOfWeek:     r.DayOfWeek,
			StartTime:     startTime,
			EndTime:       endTime,
			EffectiveFrom: effectiveFrom,
			EffectiveTo:   effectiveTo,
		})
	}

	result, err := h.schedules.Replace(c.Request().Context(), employeeID, rows)
	if err != nil {
		// Generic message — the underlying error may be a raw DB constraint
		// violation (e.g. the overlap EXCLUDE constraint) and shouldn't leak
		// to the client, matching the rest of this handler package's
		// convention of not echoing internal error text.
		return echo.NewHTTPError(http.StatusBadRequest, "บันทึกตารางเวลาไม่สำเร็จ กรุณาตรวจสอบว่าช่วงวัน/วันที่ซ้อนทับกันหรือไม่")
	}
	return c.JSON(http.StatusOK, toWorkScheduleViews(result))
}

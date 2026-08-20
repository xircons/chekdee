package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

type HolidayHandler struct {
	holidays *usecase.HolidayUsecase
}

func NewHolidayHandler(holidays *usecase.HolidayUsecase) *HolidayHandler {
	return &HolidayHandler{holidays: holidays}
}

type holidayView struct {
	ID        string  `json:"id"`
	Date      string  `json:"date"`
	Name      string  `json:"name"`
	LocalName *string `json:"local_name"`
	Source    string  `json:"source"`
}

func toHolidayView(h *domain.Holiday) holidayView {
	return holidayView{
		ID:        h.ID,
		Date:      h.Date.Format(dateLayout),
		Name:      h.Name,
		LocalName: h.LocalName,
		Source:    string(h.Source),
	}
}

// List returns holidays in [from, to]. Any authenticated user can read
// this — employees need holidays on their own calendar view.
func (h *HolidayHandler) List(c echo.Context) error {
	from, err := time.Parse(dateLayout, c.QueryParam("from"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid or missing from, expected YYYY-MM-DD")
	}
	to, err := time.Parse(dateLayout, c.QueryParam("to"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid or missing to, expected YYYY-MM-DD")
	}

	holidays, err := h.holidays.ListInRange(c.Request().Context(), from, to)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load holidays")
	}

	out := make([]holidayView, 0, len(holidays))
	for _, hol := range holidays {
		out = append(out, toHolidayView(hol))
	}
	return c.JSON(http.StatusOK, out)
}

type createHolidayRequest struct {
	Date      string `json:"date"`
	Name      string `json:"name"`
	LocalName string `json:"local_name"`
}

// Create adds a new manually-entered holiday. Mounted behind RequireRole —
// see handler.go.
func (h *HolidayHandler) Create(c echo.Context) error {
	var req createHolidayRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	date, err := time.Parse(dateLayout, req.Date)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid date, expected YYYY-MM-DD")
	}

	created, err := h.holidays.CreateManual(c.Request().Context(), date, req.Name, req.LocalName, userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "failed to create holiday")
	}
	return c.JSON(http.StatusCreated, toHolidayView(created))
}

type updateHolidayRequest struct {
	Name      string `json:"name"`
	LocalName string `json:"local_name"`
}

// Update edits an existing holiday's name/local_name without changing its
// source (nager_date stays nager_date). Mounted behind RequireRole.
func (h *HolidayHandler) Update(c echo.Context) error {
	var req updateHolidayRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}

	updated, err := h.holidays.Update(c.Request().Context(), c.Param("id"), req.Name, req.LocalName, userIDFromContext(c))
	if errors.Is(err, domain.ErrHolidayNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "holiday not found")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update holiday")
	}
	return c.JSON(http.StatusOK, toHolidayView(updated))
}

// Delete is a real delete — holidays aren't subject to the soft-delete-only
// rule that applies to users. Mounted behind RequireRole.
func (h *HolidayHandler) Delete(c echo.Context) error {
	if err := h.holidays.Delete(c.Request().Context(), c.Param("id")); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete holiday")
	}
	return c.NoContent(http.StatusNoContent)
}

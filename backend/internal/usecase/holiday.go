package usecase

import (
	"context"
	"time"

	"checkdee-backend/internal/domain"
)

type HolidayUsecase struct {
	holidays domain.HolidayRepository
}

func NewHolidayUsecase(holidays domain.HolidayRepository) *HolidayUsecase {
	return &HolidayUsecase{holidays: holidays}
}

func (h *HolidayUsecase) ListInRange(ctx context.Context, from, to time.Time) ([]*domain.Holiday, error) {
	return h.holidays.ListInRange(ctx, from, to)
}

func (h *HolidayUsecase) CreateManual(ctx context.Context, date time.Time, name, localName, updatedBy string) (*domain.Holiday, error) {
	return h.holidays.CreateManual(ctx, date, name, localName, updatedBy)
}

func (h *HolidayUsecase) Update(ctx context.Context, id, name, localName, updatedBy string) (*domain.Holiday, error) {
	return h.holidays.Update(ctx, id, name, localName, updatedBy)
}

func (h *HolidayUsecase) Delete(ctx context.Context, id string) error {
	return h.holidays.Delete(ctx, id)
}

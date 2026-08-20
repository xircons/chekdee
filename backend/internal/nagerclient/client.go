// Package nagerclient talks to the Nager.Date public holiday API
// (https://date.nager.at/api). Used by the holiday-sync river job to seed
// the holidays table; university-specific holidays that Nager.Date doesn't
// cover are added manually by an admin.
package nagerclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// countryCode is not configurable: this app is built specifically for CAMT,
// Chiang Mai University, and every other date/locale convention in the
// codebase (Thai Buddhist calendar, Asia/Bangkok timezone, Thai UI copy) is
// already Thailand-specific.
const countryCode = "TH"

const apiBase = "https://date.nager.at/api/v3/PublicHolidays"

type Holiday struct {
	Date      string `json:"date"` // "2026-01-01"
	LocalName string `json:"localName"`
	Name      string `json:"name"`
}

type Client struct {
	httpClient *http.Client
	baseURL    string
}

type Option func(*Client)

// WithBaseURL overrides the Nager.Date API base URL — used by tests to
// point the client at an httptest server instead of the real API.
func WithBaseURL(baseURL string) Option {
	return func(c *Client) { c.baseURL = baseURL }
}

func New(opts ...Option) *Client {
	c := &Client{httpClient: &http.Client{Timeout: 10 * time.Second}, baseURL: apiBase}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// PublicHolidays fetches Thailand's public holidays for the given year.
func (c *Client) PublicHolidays(ctx context.Context, year int) ([]Holiday, error) {
	url := fmt.Sprintf("%s/%d/%s", c.baseURL, year, countryCode)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("nager.date public holidays: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nager.date public holidays failed: %s", resp.Status)
	}

	var holidays []Holiday
	if err := json.NewDecoder(resp.Body).Decode(&holidays); err != nil {
		return nil, fmt.Errorf("nager.date public holidays: decode response: %w", err)
	}
	return holidays, nil
}

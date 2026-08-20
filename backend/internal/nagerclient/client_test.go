package nagerclient_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/nagerclient"
)

func TestClient_PublicHolidays(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/2026/TH", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]nagerclient.Holiday{
			{Date: "2026-01-01", Name: "New Year's Day", LocalName: "วันขึ้นปีใหม่"},
			{Date: "2026-04-13", Name: "Songkran", LocalName: "สงกรานต์"},
		})
	}))
	defer server.Close()

	client := nagerclient.New(nagerclient.WithBaseURL(server.URL))
	holidays, err := client.PublicHolidays(context.Background(), 2026)
	require.NoError(t, err)
	require.Len(t, holidays, 2)
	require.Equal(t, "2026-04-13", holidays[1].Date)
	require.Equal(t, "สงกรานต์", holidays[1].LocalName)
}

func TestClient_PublicHolidays_NonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := nagerclient.New(nagerclient.WithBaseURL(server.URL))
	_, err := client.PublicHolidays(context.Background(), 2026)
	require.Error(t, err)
}

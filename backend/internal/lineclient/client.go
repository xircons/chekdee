// Package lineclient talks to LINE Login v2.1's OAuth token and profile
// endpoints. See https://developers.line.biz/en/reference/line-login/.
package lineclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	tokenEndpoint   = "https://api.line.me/oauth2/v2.1/token"
	profileEndpoint = "https://api.line.me/v2/profile"
)

type Client struct {
	channelID     string
	channelSecret string
	httpClient    *http.Client
}

func New(channelID, channelSecret string) *Client {
	return &Client{
		channelID:     channelID,
		channelSecret: channelSecret,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
	}
}

// ExchangeCode trades an authorization code from the LINE Login redirect
// for an access token.
func (c *Client) ExchangeCode(ctx context.Context, code, redirectURI string) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", c.channelID)
	form.Set("client_secret", c.channelSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("line token exchange: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("line token exchange failed: %s", resp.Status)
	}

	var body struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("line token exchange: decode response: %w", err)
	}
	return body.AccessToken, nil
}

// GetProfile fetches the LINE user's id, display name, and picture URL.
func (c *Client) GetProfile(ctx context.Context, accessToken string) (lineUserID, displayName, pictureURL string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, profileEndpoint, nil)
	if err != nil {
		return "", "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("line get profile: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", "", fmt.Errorf("line get profile failed: %s", resp.Status)
	}

	var body struct {
		UserID      string `json:"userId"`
		DisplayName string `json:"displayName"`
		PictureURL  string `json:"pictureUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", "", "", fmt.Errorf("line get profile: decode response: %w", err)
	}
	return body.UserID, body.DisplayName, body.PictureURL, nil
}

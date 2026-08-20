// Package lineclient talks to LINE Login v2.1's OAuth token and verification
// endpoints. See https://developers.line.biz/en/reference/line-login/.
package lineclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	authorizeEndpoint = "https://access.line.me/oauth2/v2.1/authorize"
	tokenEndpoint     = "https://api.line.me/oauth2/v2.1/token"
	verifyEndpoint    = "https://api.line.me/oauth2/v2.1/verify"

	// openid is required so the token response carries an id_token; profile
	// lets that id_token include the display name and picture, so the
	// separate /v2/profile call (which only carried a bearer token, not a
	// verifiable identity) is no longer needed.
	loginScope = "openid profile"
)

var ErrIDTokenInvalid = errors.New("line id_token verification failed")

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

// AuthorizeURL builds the LINE Login authorization URL. state guards against
// login CSRF (bound to a cookie by the caller) and nonce binds the returned
// id_token to this single attempt.
func (c *Client) AuthorizeURL(redirectURI, state, nonce string) string {
	q := url.Values{}
	q.Set("response_type", "code")
	q.Set("client_id", c.channelID)
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	q.Set("scope", loginScope)
	q.Set("nonce", nonce)
	return authorizeEndpoint + "?" + q.Encode()
}

// ExchangeCode trades an authorization code from the LINE Login redirect for
// an access token and the OpenID id_token.
func (c *Client) ExchangeCode(ctx context.Context, code, redirectURI string) (accessToken, idToken string, err error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", c.channelID)
	form.Set("client_secret", c.channelSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("line token exchange: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("line token exchange failed: %s", resp.Status)
	}

	var body struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", "", fmt.Errorf("line token exchange: decode response: %w", err)
	}
	return body.AccessToken, body.IDToken, nil
}

// VerifyIDToken verifies the id_token through LINE's verification endpoint,
// which checks the signature and that the audience matches this channel. The
// nonce is checked here against the value issued for this attempt so a
// captured id_token cannot be replayed. The returned user id comes from the
// verified token, not an unauthenticated profile lookup.
func (c *Client) VerifyIDToken(ctx context.Context, idToken, expectedNonce string) (lineUserID, displayName, pictureURL string, err error) {
	if idToken == "" {
		return "", "", "", ErrIDTokenInvalid
	}
	if expectedNonce == "" {
		return "", "", "", ErrIDTokenInvalid
	}

	form := url.Values{}
	form.Set("id_token", idToken)
	form.Set("client_id", c.channelID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, verifyEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("line verify id_token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", "", ErrIDTokenInvalid
	}

	var body struct {
		Sub     string `json:"sub"`
		Aud     string `json:"aud"`
		Nonce   string `json:"nonce"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", "", "", fmt.Errorf("line verify id_token: decode response: %w", err)
	}

	// LINE's endpoint verifies the signature and audience; the nonce is
	// application state, so it must be checked here.
	if body.Aud != c.channelID || body.Sub == "" || body.Nonce != expectedNonce {
		return "", "", "", ErrIDTokenInvalid
	}
	return body.Sub, body.Name, body.Picture, nil
}

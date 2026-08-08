package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

const refreshCookieName = "checkdee_refresh_token"

type AuthHandler struct {
	auth *usecase.AuthUsecase
}

func NewAuthHandler(auth *usecase.AuthUsecase) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type lineLoginRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirect_uri"`
}

type authResponse struct {
	AccessToken string    `json:"access_token"`
	ExpiresAt   time.Time `json:"expires_at"`
	User        userView  `json:"user"`
}

type userView struct {
	ID           string  `json:"id"`
	Role         string  `json:"role"`
	FirstName    *string `json:"first_name"`
	LastName     *string `json:"last_name"`
	DisplayName  *string `json:"display_name"`
	PictureURL   *string `json:"picture_url"`
	IsRegistered bool    `json:"is_registered"`
}

func toUserView(u *domain.User) userView {
	return userView{
		ID:           u.ID,
		Role:         string(u.Role),
		FirstName:    u.FirstName,
		LastName:     u.LastName,
		DisplayName:  u.LineDisplayName,
		PictureURL:   u.LinePictureURL,
		IsRegistered: u.IsRegistered(),
	}
}

func (h *AuthHandler) LineLogin(c echo.Context) error {
	var req lineLoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Code == "" || req.RedirectURI == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "code and redirect_uri are required")
	}

	user, tokens, err := h.auth.LoginWithLine(c.Request().Context(), req.Code, req.RedirectURI, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		if errors.Is(err, usecase.ErrAccountDeactivated) {
			return echo.NewHTTPError(http.StatusForbidden, "account deactivated")
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "line login failed")
	}

	setRefreshCookie(c, tokens.RefreshToken)

	return c.JSON(http.StatusOK, authResponse{
		AccessToken: tokens.AccessToken,
		ExpiresAt:   tokens.ExpiresAt,
		User:        toUserView(user),
	})
}

type passwordLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// PasswordLogin authenticates the system_owner account — the only role
// that doesn't use LINE login.
func (h *AuthHandler) PasswordLogin(c echo.Context) error {
	var req passwordLoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.Username == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "username and password are required")
	}

	user, tokens, err := h.auth.LoginWithPassword(c.Request().Context(), req.Username, req.Password, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		if errors.Is(err, usecase.ErrAccountDeactivated) {
			return echo.NewHTTPError(http.StatusForbidden, "account deactivated")
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid username or password")
	}

	setRefreshCookie(c, tokens.RefreshToken)

	return c.JSON(http.StatusOK, authResponse{
		AccessToken: tokens.AccessToken,
		ExpiresAt:   tokens.ExpiresAt,
		User:        toUserView(user),
	})
}

func (h *AuthHandler) Refresh(c echo.Context) error {
	cookie, err := c.Cookie(refreshCookieName)
	if err != nil || cookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "missing refresh token")
	}

	tokens, err := h.auth.Refresh(c.Request().Context(), cookie.Value, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		clearRefreshCookie(c)
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid refresh token")
	}

	setRefreshCookie(c, tokens.RefreshToken)

	return c.JSON(http.StatusOK, map[string]any{
		"access_token": tokens.AccessToken,
		"expires_at":   tokens.ExpiresAt,
	})
}

func (h *AuthHandler) Logout(c echo.Context) error {
	cookie, err := c.Cookie(refreshCookieName)
	if err == nil && cookie.Value != "" {
		_ = h.auth.Logout(c.Request().Context(), cookie.Value)
	}
	clearRefreshCookie(c)
	return c.NoContent(http.StatusNoContent)
}

type completeRegistrationRequest struct {
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	StudentGen string `json:"student_gen"`
}

// CompleteRegistration finishes onboarding for the authenticated user.
// Mounted behind RequireAuth — see handler.go.
func (h *AuthHandler) CompleteRegistration(c echo.Context) error {
	var req completeRegistrationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.FirstName == "" || req.LastName == "" || req.StudentGen == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "first_name, last_name, and student_gen are required")
	}

	user, err := h.auth.CompleteRegistration(c.Request().Context(), userIDFromContext(c), req.FirstName, req.LastName, req.StudentGen)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to complete registration")
	}

	return c.JSON(http.StatusOK, toUserView(user))
}

// Me returns the authenticated user. Mounted behind RequireAuth.
func (h *AuthHandler) Me(c echo.Context) error {
	user, err := h.auth.Me(c.Request().Context(), userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}
	return c.JSON(http.StatusOK, toUserView(user))
}

func setRefreshCookie(c echo.Context, value string) {
	c.SetCookie(&http.Cookie{
		Name:     refreshCookieName,
		Value:    value,
		Path:     "/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(usecase.RefreshTokenTTL),
	})
}

func clearRefreshCookie(c echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

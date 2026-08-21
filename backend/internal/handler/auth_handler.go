package handler

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

const (
	refreshCookieName = "checkdee_refresh_token"
	// Short-lived cookies that bind a LINE login attempt: state guards
	// against login CSRF, nonce binds the returned id_token to this attempt.
	stateCookieName = "checkdee_line_state"
	nonceCookieName = "checkdee_line_nonce"
	oauthCookieTTL  = 10 * time.Minute
)

type AuthHandler struct {
	auth *usecase.AuthUsecase
}

func NewAuthHandler(auth *usecase.AuthUsecase) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type lineLoginRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirect_uri"`
	State       string `json:"state"`
}

type lineAuthorizeResponse struct {
	AuthorizeURL string `json:"authorize_url"`
}

// LineAuthorize starts a LINE login: it mints a state + nonce, binds them to
// short-lived httpOnly cookies, and returns the LINE authorization URL the
// client should redirect to. The state comes back as a query parameter and
// is checked against the cookie in LineLogin; the nonce is checked inside the
// id_token.
func (h *AuthHandler) LineAuthorize(c echo.Context) error {
	redirectURI := c.QueryParam("redirect_uri")
	if redirectURI == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุ redirect_uri")
	}

	state, err := randomToken()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "เริ่มกระบวนการเข้าสู่ระบบไม่สำเร็จ")
	}
	nonce, err := randomToken()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "เริ่มกระบวนการเข้าสู่ระบบไม่สำเร็จ")
	}

	setOAuthCookie(c, stateCookieName, state)
	setOAuthCookie(c, nonceCookieName, nonce)

	return c.JSON(http.StatusOK, lineAuthorizeResponse{
		AuthorizeURL: h.auth.AuthorizeURL(redirectURI, state, nonce),
	})
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
	StudentID    *string `json:"student_id"`
	PhoneNumber  *string `json:"phone_number"`
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
		StudentID:    u.StudentID,
		PhoneNumber:  u.PhoneNumber,
		DisplayName:  u.LineDisplayName,
		PictureURL:   u.LinePictureURL,
		IsRegistered: u.IsRegistered(),
	}
}

func (h *AuthHandler) LineLogin(c echo.Context) error {
	var req lineLoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.Code == "" || req.RedirectURI == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุ code และ redirect_uri")
	}

	// Bind the callback to the attempt started by LineAuthorize: the state in
	// the body must match the state cookie, and the nonce cookie is what the
	// id_token is verified against.
	stateCookie, err := c.Cookie(stateCookieName)
	if err != nil || stateCookie.Value == "" || req.State == "" || req.State != stateCookie.Value {
		return echo.NewHTTPError(http.StatusUnauthorized, "สถานะการเข้าสู่ระบบไม่ถูกต้อง")
	}
	nonceCookie, err := c.Cookie(nonceCookieName)
	if err != nil || nonceCookie.Value == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "สถานะการเข้าสู่ระบบไม่ถูกต้อง")
	}
	clearOAuthCookie(c, stateCookieName)
	clearOAuthCookie(c, nonceCookieName)

	user, tokens, err := h.auth.LoginWithLine(c.Request().Context(), req.Code, req.RedirectURI, nonceCookie.Value, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		if errors.Is(err, usecase.ErrAccountDeactivated) {
			return echo.NewHTTPError(http.StatusForbidden, "บัญชีถูกระงับการใช้งาน")
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ")
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
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.Username == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุชื่อผู้ใช้และรหัสผ่าน")
	}

	user, tokens, err := h.auth.LoginWithPassword(c.Request().Context(), req.Username, req.Password, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		if errors.Is(err, usecase.ErrAccountDeactivated) {
			return echo.NewHTTPError(http.StatusForbidden, "บัญชีถูกระงับการใช้งาน")
		}
		return echo.NewHTTPError(http.StatusUnauthorized, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
	}

	setRefreshCookie(c, tokens.RefreshToken)

	return c.JSON(http.StatusOK, authResponse{
		AccessToken: tokens.AccessToken,
		ExpiresAt:   tokens.ExpiresAt,
		User:        toUserView(user),
	})
}

type devLoginRequest struct {
	Role string `json:"role"`
}

// DevLogin is only wired up in development (see server.New) -- it issues a
// real token pair for one of four fixed seeded users, one per role, so the
// frontend's dev-login bypass buttons behave exactly like a real login
// instead of faking a session client-side.
func (h *AuthHandler) DevLogin(c echo.Context) error {
	var req devLoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	role := domain.Role(req.Role)
	switch role {
	case domain.RoleEmployee, domain.RoleSupervisor, domain.RoleAdmin, domain.RoleSystemOwner:
	default:
		return echo.NewHTTPError(http.StatusBadRequest, "invalid role")
	}

	user, tokens, err := h.auth.DevLogin(c.Request().Context(), role, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "dev login failed")
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
		return echo.NewHTTPError(http.StatusUnauthorized, "ไม่พบ refresh token")
	}

	tokens, err := h.auth.Refresh(c.Request().Context(), cookie.Value, c.Request().UserAgent(), c.RealIP())
	if err != nil {
		clearRefreshCookie(c)
		return echo.NewHTTPError(http.StatusUnauthorized, "refresh token ไม่ถูกต้อง")
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
	// StudentID/PhoneNumber are optional — adding them as a required pair
	// would break registration for anyone already mid-flow.
	StudentID   string `json:"student_id"`
	PhoneNumber string `json:"phone_number"`
}

// CompleteRegistration finishes onboarding for the authenticated user.
// Mounted behind RequireAuth — see handler.go.
func (h *AuthHandler) CompleteRegistration(c echo.Context) error {
	var req completeRegistrationRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "ข้อมูลคำขอไม่ถูกต้อง")
	}
	if req.FirstName == "" || req.LastName == "" || req.StudentGen == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "ต้องระบุชื่อ นามสกุล และรุ่นนักศึกษา")
	}

	var studentID, phoneNumber *string
	if req.StudentID != "" {
		studentID = &req.StudentID
	}
	if req.PhoneNumber != "" {
		phoneNumber = &req.PhoneNumber
	}

	user, err := h.auth.CompleteRegistration(c.Request().Context(), userIDFromContext(c), req.FirstName, req.LastName, req.StudentGen, studentID, phoneNumber)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "ลงทะเบียนไม่สำเร็จ")
	}

	return c.JSON(http.StatusOK, toUserView(user))
}

// Me returns the authenticated user. Mounted behind RequireAuth.
func (h *AuthHandler) Me(c echo.Context) error {
	user, err := h.auth.Me(c.Request().Context(), userIDFromContext(c))
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "ไม่พบผู้ใช้งาน")
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

func setOAuthCookie(c echo.Context, name, value string) {
	c.SetCookie(&http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(oauthCookieTTL),
	})
}

func clearOAuthCookie(c echo.Context, name string) {
	c.SetCookie(&http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/auth",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

// randomToken returns a URL-safe 256-bit random string for the OAuth state
// and nonce.
func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

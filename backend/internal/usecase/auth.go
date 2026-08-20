package usecase

import (
	"context"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"

	"checkdee-backend/internal/domain"
)

var (
	ErrAccountDeactivated = errors.New("account deactivated")
	ErrNotRegistered      = errors.New("registration not completed")
	ErrInvalidCredentials = errors.New("invalid username or password")
)

// LineClient exchanges a LINE Login authorization code for a verified
// identity. Implemented by internal/lineclient.
type LineClient interface {
	AuthorizeURL(redirectURI, state, nonce string) string
	ExchangeCode(ctx context.Context, code, redirectURI string) (accessToken, idToken string, err error)
	// VerifyIDToken verifies the id_token (signature + audience) and the
	// nonce binding, returning the authoritative LINE user id and profile.
	VerifyIDToken(ctx context.Context, idToken, expectedNonce string) (lineUserID, displayName, pictureURL string, err error)
}

type AuthUsecase struct {
	users         domain.UserRepository
	refreshTokens domain.RefreshTokenRepository
	line          LineClient
	jwt           *JWTIssuer
}

func NewAuthUsecase(users domain.UserRepository, refreshTokens domain.RefreshTokenRepository, line LineClient, jwt *JWTIssuer) *AuthUsecase {
	return &AuthUsecase{users: users, refreshTokens: refreshTokens, line: line, jwt: jwt}
}

// AuthorizeURL returns the LINE Login URL to redirect the user to, carrying
// the CSRF state and id_token nonce the caller has bound to cookies.
func (a *AuthUsecase) AuthorizeURL(redirectURI, state, nonce string) string {
	return a.line.AuthorizeURL(redirectURI, state, nonce)
}

// LoginWithLine exchanges the LINE authorization code for a verified
// id_token, derives the identity from it (nonce-bound, so the token can't be
// replayed), finds-or-creates the corresponding user (always as 'employee'
// on first login — promotion to admin/supervisor is a system_owner action),
// and issues a token pair.
func (a *AuthUsecase) LoginWithLine(ctx context.Context, code, redirectURI, nonce, userAgent, ip string) (*domain.User, TokenPair, error) {
	_, idToken, err := a.line.ExchangeCode(ctx, code, redirectURI)
	if err != nil {
		return nil, TokenPair{}, err
	}

	lineUserID, displayName, pictureURL, err := a.line.VerifyIDToken(ctx, idToken, nonce)
	if err != nil {
		return nil, TokenPair{}, err
	}

	user, err := a.users.GetByLineUserID(ctx, lineUserID)
	switch {
	case errors.Is(err, domain.ErrUserNotFound):
		user, err = a.users.CreateEmployeeFromLine(ctx, lineUserID, displayName, pictureURL)
		if err != nil {
			return nil, TokenPair{}, err
		}
	case err != nil:
		return nil, TokenPair{}, err
	default:
		if updateErr := a.users.UpdateLineProfile(ctx, user.ID, displayName, pictureURL); updateErr != nil {
			return nil, TokenPair{}, updateErr
		}
	}

	if !user.IsActive() {
		return nil, TokenPair{}, ErrAccountDeactivated
	}

	tokens, err := a.issueTokens(ctx, user, userAgent, ip)
	return user, tokens, err
}

// LoginWithPassword authenticates the system_owner account — the only
// role that doesn't use LINE login.
func (a *AuthUsecase) LoginWithPassword(ctx context.Context, username, password, userAgent, ip string) (*domain.User, TokenPair, error) {
	user, err := a.users.GetByUsername(ctx, username)
	if err != nil {
		return nil, TokenPair{}, ErrInvalidCredentials
	}

	if user.PasswordHash == nil {
		return nil, TokenPair{}, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, TokenPair{}, ErrInvalidCredentials
	}

	if !user.IsActive() {
		return nil, TokenPair{}, ErrAccountDeactivated
	}

	tokens, err := a.issueTokens(ctx, user, userAgent, ip)
	return user, tokens, err
}

func (a *AuthUsecase) issueTokens(ctx context.Context, user *domain.User, userAgent, ip string) (TokenPair, error) {
	access, expiresAt, err := a.jwt.IssueAccessToken(user)
	if err != nil {
		return TokenPair{}, err
	}

	refreshRaw, refreshHash, err := generateRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}

	if err := a.refreshTokens.Create(ctx, user.ID, refreshHash, userAgent, ip, time.Now().Add(RefreshTokenTTL)); err != nil {
		return TokenPair{}, err
	}

	return TokenPair{AccessToken: access, RefreshToken: refreshRaw, ExpiresAt: expiresAt}, nil
}

// Refresh rotates a refresh token: the presented token is revoked and a new
// pair is issued. Reuse is actually detected here — a token that exists but
// is already revoked can only be a replay (the legitimate client already
// rotated it away), so the whole family for that user is revoked, forcing a
// fresh login everywhere and containing a stolen token to a single reuse.
func (a *AuthUsecase) Refresh(ctx context.Context, refreshTokenRaw, userAgent, ip string) (TokenPair, error) {
	hash := hashRefreshToken(refreshTokenRaw)

	rt, err := a.refreshTokens.GetByHash(ctx, hash)
	if err != nil {
		// Unknown token: nothing to revoke, nothing to trust.
		return TokenPair{}, domain.ErrRefreshTokenInvalid
	}

	// Replay of an already-revoked token: revoke every active token for the
	// user (the rotation family) as a breach response, then reject.
	if rt.RevokedAt != nil {
		_ = a.refreshTokens.RevokeAllForUser(ctx, rt.UserID)
		return TokenPair{}, domain.ErrRefreshTokenInvalid
	}

	if rt.ExpiresAt.Before(time.Now()) {
		return TokenPair{}, domain.ErrRefreshTokenInvalid
	}

	user, err := a.users.GetByID(ctx, rt.UserID)
	if err != nil {
		return TokenPair{}, err
	}
	if !user.IsActive() {
		return TokenPair{}, ErrAccountDeactivated
	}

	if err := a.refreshTokens.Revoke(ctx, hash); err != nil {
		return TokenPair{}, err
	}

	return a.issueTokens(ctx, user, userAgent, ip)
}

// Logout revokes the refresh token server-side — deleting the cookie
// client-side is not enough, see design.md security rules.
func (a *AuthUsecase) Logout(ctx context.Context, refreshTokenRaw string) error {
	return a.refreshTokens.Revoke(ctx, hashRefreshToken(refreshTokenRaw))
}

// CompleteRegistration finishes onboarding. Employees cannot check in
// until this has been called.
func (a *AuthUsecase) CompleteRegistration(ctx context.Context, userID, firstName, lastName, studentGen string) (*domain.User, error) {
	return a.users.CompleteRegistration(ctx, userID, firstName, lastName, studentGen)
}

// Me returns the authenticated user — used by the frontend on page load
// to check session validity and registration status.
func (a *AuthUsecase) Me(ctx context.Context, userID string) (*domain.User, error) {
	return a.users.GetByID(ctx, userID)
}

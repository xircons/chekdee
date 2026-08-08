package usecase

import (
	"context"
	"errors"
	"time"

	"checkdee-backend/internal/domain"
)

var (
	ErrAccountDeactivated = errors.New("account deactivated")
	ErrNotRegistered      = errors.New("registration not completed")
)

// LineClient exchanges a LINE Login authorization code for the user's
// profile. Implemented by internal/lineclient.
type LineClient interface {
	ExchangeCode(ctx context.Context, code, redirectURI string) (accessToken string, err error)
	GetProfile(ctx context.Context, accessToken string) (lineUserID, displayName, pictureURL string, err error)
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

// LoginWithLine exchanges the LINE authorization code for a profile,
// finds-or-creates the corresponding user (always as 'employee' on first
// login — promotion to admin/supervisor is a system_owner action), and
// issues a token pair.
func (a *AuthUsecase) LoginWithLine(ctx context.Context, code, redirectURI, userAgent, ip string) (*domain.User, TokenPair, error) {
	accessToken, err := a.line.ExchangeCode(ctx, code, redirectURI)
	if err != nil {
		return nil, TokenPair{}, err
	}

	lineUserID, displayName, pictureURL, err := a.line.GetProfile(ctx, accessToken)
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

// Refresh rotates a refresh token: the presented token is revoked and a
// new pair is issued, so a leaked-and-reused token is detectable (its
// hash will already be revoked on the attacker's replay).
func (a *AuthUsecase) Refresh(ctx context.Context, refreshTokenRaw, userAgent, ip string) (TokenPair, error) {
	hash := hashRefreshToken(refreshTokenRaw)

	rt, err := a.refreshTokens.GetActive(ctx, hash)
	if err != nil {
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

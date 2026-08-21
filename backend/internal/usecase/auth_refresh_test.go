package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/domain"
	"checkdee-backend/internal/usecase"
)

// fakeRefreshRepo returns a single preconfigured token regardless of hash, so
// tests can drive Refresh through each token state without reproducing the
// hashing. It records whether the rotation family was revoked.
type fakeRefreshRepo struct {
	token         *domain.RefreshToken // nil => unknown token
	revokedHashes []string
	revokedAllFor string
	created       int
}

func (f *fakeRefreshRepo) Create(_ context.Context, _, _, _, _ string, _ time.Time) error {
	f.created++
	return nil
}

func (f *fakeRefreshRepo) GetActive(_ context.Context, _ string) (*domain.RefreshToken, error) {
	if f.token == nil || f.token.RevokedAt != nil {
		return nil, domain.ErrRefreshTokenInvalid
	}
	return f.token, nil
}

func (f *fakeRefreshRepo) GetByHash(_ context.Context, _ string) (*domain.RefreshToken, error) {
	if f.token == nil {
		return nil, domain.ErrRefreshTokenInvalid
	}
	return f.token, nil
}

func (f *fakeRefreshRepo) Revoke(_ context.Context, hash string) error {
	f.revokedHashes = append(f.revokedHashes, hash)
	return nil
}

func (f *fakeRefreshRepo) RevokeAllForUser(_ context.Context, userID string) error {
	f.revokedAllFor = userID
	return nil
}

// fakeUserRepo only needs GetByID for the refresh path; the rest satisfy the
// interface and are unused here.
type fakeUserRepo struct{ user *domain.User }

func (f *fakeUserRepo) GetByID(_ context.Context, _ string) (*domain.User, error) {
	if f.user == nil {
		return nil, domain.ErrUserNotFound
	}
	return f.user, nil
}
func (f *fakeUserRepo) GetByLineUserID(context.Context, string) (*domain.User, error) {
	return nil, domain.ErrUserNotFound
}
func (f *fakeUserRepo) GetByUsername(context.Context, string) (*domain.User, error) {
	return nil, domain.ErrUserNotFound
}
func (f *fakeUserRepo) CreateEmployeeFromLine(context.Context, string, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepo) UpdateLineProfile(context.Context, string, string, string) error { return nil }
func (f *fakeUserRepo) CompleteRegistration(context.Context, string, string, string, string, *string, *string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepo) CreateSystemOwner(context.Context, string, string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepo) ListActiveEmployees(context.Context) ([]*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepo) List(context.Context, domain.EmployeeListFilter) ([]*domain.User, int, error) {
	return nil, 0, nil
}
func (f *fakeUserRepo) Update(context.Context, string, *string, *string, *string, *string, *string, *string) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepo) UpdateRole(context.Context, string, domain.Role, *domain.AdminAuditLog) (*domain.User, error) {
	return nil, nil
}
func (f *fakeUserRepo) Offboard(context.Context, string, *string, *domain.AdminAuditLog) (*domain.User, error) {
	return nil, nil
}

// fakeLineClient is unused by Refresh but required by the constructor.
type fakeLineClient struct{}

func (fakeLineClient) AuthorizeURL(string, string, string) string { return "" }
func (fakeLineClient) ExchangeCode(context.Context, string, string) (string, string, error) {
	return "", "", nil
}
func (fakeLineClient) VerifyIDToken(context.Context, string, string) (string, string, string, error) {
	return "", "", "", nil
}

func activeUser() *domain.User {
	return &domain.User{ID: "user-1", Role: domain.RoleEmployee, Status: domain.UserStatusActive}
}

func newAuth(refresh *fakeRefreshRepo, users *fakeUserRepo) *usecase.AuthUsecase {
	jwt := usecase.NewJWTIssuer("test-secret-at-least-32-bytes-long-xx")
	return usecase.NewAuthUsecase(users, refresh, fakeLineClient{}, jwt)
}

func TestRefresh_ActiveTokenRotates(t *testing.T) {
	refresh := &fakeRefreshRepo{token: &domain.RefreshToken{
		ID: "rt-1", UserID: "user-1", TokenHash: "h", ExpiresAt: time.Now().Add(time.Hour),
	}}
	auth := newAuth(refresh, &fakeUserRepo{user: activeUser()})

	pair, err := auth.Refresh(context.Background(), "raw-token", "agent", "127.0.0.1")
	require.NoError(t, err)
	require.NotEmpty(t, pair.AccessToken)
	require.NotEmpty(t, pair.RefreshToken)
	require.Len(t, refresh.revokedHashes, 1, "the presented token must be revoked on rotation")
	require.Empty(t, refresh.revokedAllFor, "a normal rotation must not revoke the whole family")
	require.Equal(t, 1, refresh.created, "a new refresh token must be issued")
}

func TestRefresh_RevokedReplayRevokesFamily(t *testing.T) {
	revokedAt := time.Now().Add(-time.Minute)
	refresh := &fakeRefreshRepo{token: &domain.RefreshToken{
		ID: "rt-1", UserID: "user-1", TokenHash: "h",
		ExpiresAt: time.Now().Add(time.Hour), RevokedAt: &revokedAt,
	}}
	auth := newAuth(refresh, &fakeUserRepo{user: activeUser()})

	_, err := auth.Refresh(context.Background(), "raw-token", "agent", "127.0.0.1")
	require.ErrorIs(t, err, domain.ErrRefreshTokenInvalid)
	require.Equal(t, "user-1", refresh.revokedAllFor, "replay of a revoked token must revoke the family")
	require.Zero(t, refresh.created, "no new token on a detected replay")
}

func TestRefresh_UnknownToken(t *testing.T) {
	refresh := &fakeRefreshRepo{token: nil}
	auth := newAuth(refresh, &fakeUserRepo{user: activeUser()})

	_, err := auth.Refresh(context.Background(), "raw-token", "agent", "127.0.0.1")
	require.ErrorIs(t, err, domain.ErrRefreshTokenInvalid)
	require.Empty(t, refresh.revokedAllFor, "an unknown token is not a family compromise")
}

func TestRefresh_ExpiredToken(t *testing.T) {
	refresh := &fakeRefreshRepo{token: &domain.RefreshToken{
		ID: "rt-1", UserID: "user-1", TokenHash: "h", ExpiresAt: time.Now().Add(-time.Hour),
	}}
	auth := newAuth(refresh, &fakeUserRepo{user: activeUser()})

	_, err := auth.Refresh(context.Background(), "raw-token", "agent", "127.0.0.1")
	require.ErrorIs(t, err, domain.ErrRefreshTokenInvalid)
	require.Empty(t, refresh.revokedAllFor)
	require.Zero(t, refresh.created)
}

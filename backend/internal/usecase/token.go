package usecase

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"checkdee-backend/internal/domain"
)

const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 30 * 24 * time.Hour
)

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
}

type accessTokenClaims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

// JWTIssuer signs and parses access tokens. Refresh tokens are opaque
// random values (not JWTs) so they can be revoked server-side by looking
// up their hash — see design.md security rules.
type JWTIssuer struct {
	secret []byte
}

func NewJWTIssuer(secret string) *JWTIssuer {
	return &JWTIssuer{secret: []byte(secret)}
}

func (j *JWTIssuer) IssueAccessToken(user *domain.User) (string, time.Time, error) {
	expiresAt := time.Now().Add(AccessTokenTTL)
	claims := accessTokenClaims{
		Role: string(user.Role),
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(j.secret)
	return signed, expiresAt, err
}

var ErrInvalidAccessToken = errors.New("invalid access token")

func (j *JWTIssuer) ParseAccessToken(tokenString string) (userID string, role domain.Role, err error) {
	var claims accessTokenClaims
	token, err := jwt.ParseWithClaims(tokenString, &claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidAccessToken
		}
		return j.secret, nil
	})
	if err != nil || !token.Valid {
		return "", "", ErrInvalidAccessToken
	}
	return claims.Subject, domain.Role(claims.Role), nil
}

// generateRefreshToken returns the raw token (set on the httpOnly cookie)
// and its SHA-256 hash (what gets stored in the database).
func generateRefreshToken() (raw string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(buf)
	return raw, hashRefreshToken(raw), nil
}

func hashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

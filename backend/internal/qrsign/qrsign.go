// Package qrsign signs and verifies the ephemeral QR payload displayed on a
// kiosk TV screen. This is a distinct secret from a kiosk device's own
// long-lived link token (domain.KioskDevice) — see the QR/kiosk model note
// in PLAN.md. Verify only checks signature + expiry; single-use enforcement
// is the caller's job via the consumed_qr_nonces table, keyed on the nonce
// this package returns.
package qrsign

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidToken = errors.New("invalid or expired qr token")

type Signer struct {
	secret []byte
}

func NewSigner(secret string) *Signer {
	return &Signer{secret: []byte(secret)}
}

// Sign mints a new token for deviceID, valid for ttl. The returned nonce is
// what the caller inserts into consumed_qr_nonces to enforce single-use.
func (s *Signer) Sign(deviceID string, ttl time.Duration) (token, nonce string, expiresAt time.Time, err error) {
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", "", time.Time{}, err
	}
	nonce = base64.RawURLEncoding.EncodeToString(nonceBytes)
	expiresAt = time.Now().Add(ttl)

	payload := fmt.Sprintf("%s|%s|%d", deviceID, nonce, expiresAt.Unix())
	encodedPayload := base64.RawURLEncoding.EncodeToString([]byte(payload))
	return encodedPayload + "." + s.sign(encodedPayload), nonce, expiresAt, nil
}

func (s *Signer) sign(encodedPayload string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(encodedPayload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// Verify checks the signature and expiry, returning the embedded deviceID
// and nonce. It does not consume the nonce.
func (s *Signer) Verify(token string) (deviceID, nonce string, err error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return "", "", ErrInvalidToken
	}
	encodedPayload, sig := parts[0], parts[1]

	expectedSig := s.sign(encodedPayload)
	if subtle.ConstantTimeCompare([]byte(sig), []byte(expectedSig)) != 1 {
		return "", "", ErrInvalidToken
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return "", "", ErrInvalidToken
	}
	fields := strings.Split(string(payloadBytes), "|")
	if len(fields) != 3 {
		return "", "", ErrInvalidToken
	}
	deviceID, nonce = fields[0], fields[1]

	expiresAtUnix, err := strconv.ParseInt(fields[2], 10, 64)
	if err != nil {
		return "", "", ErrInvalidToken
	}
	if time.Now().Unix() > expiresAtUnix {
		return "", "", ErrInvalidToken
	}
	return deviceID, nonce, nil
}

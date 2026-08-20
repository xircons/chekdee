package qrsign_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"checkdee-backend/internal/qrsign"
)

func TestSigner_SignVerify_RoundTrip(t *testing.T) {
	signer := qrsign.NewSigner("test-secret")

	token, nonce, expiresAt, err := signer.Sign("device-1", 15*time.Second)
	require.NoError(t, err)
	require.NotEmpty(t, token)
	require.NotEmpty(t, nonce)
	require.WithinDuration(t, time.Now().Add(15*time.Second), expiresAt, time.Second)

	deviceID, gotNonce, err := signer.Verify(token)
	require.NoError(t, err)
	require.Equal(t, "device-1", deviceID)
	require.Equal(t, nonce, gotNonce)
}

func TestSigner_Verify_ExpiredToken(t *testing.T) {
	signer := qrsign.NewSigner("test-secret")

	token, _, _, err := signer.Sign("device-1", -1*time.Second) // already expired
	require.NoError(t, err)

	_, _, err = signer.Verify(token)
	require.ErrorIs(t, err, qrsign.ErrInvalidToken)
}

func TestSigner_Verify_WrongSecret(t *testing.T) {
	signer := qrsign.NewSigner("test-secret")
	other := qrsign.NewSigner("different-secret")

	token, _, _, err := signer.Sign("device-1", 15*time.Second)
	require.NoError(t, err)

	_, _, err = other.Verify(token)
	require.ErrorIs(t, err, qrsign.ErrInvalidToken)
}

func TestSigner_Verify_TamperedPayload(t *testing.T) {
	signer := qrsign.NewSigner("test-secret")

	token, _, _, err := signer.Sign("device-1", 15*time.Second)
	require.NoError(t, err)

	tampered := token[:len(token)-4] + "aaaa"
	_, _, err = signer.Verify(tampered)
	require.ErrorIs(t, err, qrsign.ErrInvalidToken)
}

func TestSigner_Verify_MalformedToken(t *testing.T) {
	signer := qrsign.NewSigner("test-secret")

	_, _, err := signer.Verify("not-a-valid-token")
	require.ErrorIs(t, err, qrsign.ErrInvalidToken)
}

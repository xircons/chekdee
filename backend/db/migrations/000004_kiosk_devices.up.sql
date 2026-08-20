-- Long-lived device-link tokens, modelled as immutable history (mirrors
-- refresh_tokens) rather than a mutable token_hash column: rotate = insert a
-- new row and stamp revoked_at on the previous active row in one transaction,
-- so "which token was valid for this screen at time T" stays answerable for
-- incident review. device_id is the stable identity of a physical screen and
-- is constant across rotations; each row is one token issuance for it.
CREATE TABLE kiosk_devices (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one live token per screen at any time; the active-token lookup
-- and the rotate/revoke transaction both key off this.
CREATE UNIQUE INDEX idx_kiosk_devices_active
    ON kiosk_devices(device_id) WHERE revoked_at IS NULL;

-- Single-use store for the ephemeral 15s QR nonces. A nonce is verified by
-- HMAC signature + expiry, then inserted here to consume it; the primary key
-- makes a replay (photographed QR relayed to a second phone) fail on the
-- second insert. expires_at lets a sweeper prune rows once they can no longer
-- be presented.
CREATE TABLE consumed_qr_nonces (
    nonce       TEXT PRIMARY KEY,
    device_id   UUID NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consumed_qr_nonces_expires_at ON consumed_qr_nonces(expires_at);

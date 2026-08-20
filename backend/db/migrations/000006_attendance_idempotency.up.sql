-- Client-supplied idempotency keys for check-in/check-out submits. A kiosk
-- or phone retrying after a dropped response reuses the same key; the
-- check-in/out usecase looks this up before touching the QR nonce or the
-- attendance row, so a retry returns the first attempt's result instead of
-- being rejected (the QR nonce is already consumed) or double-processed.
-- key is TEXT, not UUID: an idempotency key is an opaque client-generated
-- string (mirroring e.g. Stripe's Idempotency-Key header) — clients aren't
-- required to mint a real UUID for it.
CREATE TABLE attendance_idempotency_keys (
    key                   TEXT PRIMARY KEY,
    attendance_record_id  UUID NOT NULL REFERENCES attendance_records(id) ON DELETE RESTRICT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

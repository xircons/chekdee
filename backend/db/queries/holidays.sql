-- name: UpsertSyncedHoliday :one
-- Used by the Nager.Date sync job. ON CONFLICT only touches name/local_name
-- so a manual edit (source='manual' or a later updated_at) isn't clobbered
-- by a re-sync — callers should check updated_by before overwriting.
INSERT INTO holidays (date, name, local_name, source)
VALUES ($1, $2, $3, 'nager_date')
ON CONFLICT (date) DO UPDATE
SET name = EXCLUDED.name, local_name = EXCLUDED.local_name, updated_at = now()
WHERE holidays.updated_by IS NULL
RETURNING *;

-- name: CreateOrUpdateManualHoliday :one
INSERT INTO holidays (date, name, local_name, source, updated_by)
VALUES ($1, $2, $3, 'manual', $4)
ON CONFLICT (date) DO UPDATE
SET name = EXCLUDED.name, local_name = EXCLUDED.local_name,
    source = 'manual', updated_by = EXCLUDED.updated_by, updated_at = now()
RETURNING *;

-- name: GetHolidayByDate :one
SELECT * FROM holidays WHERE date = $1;

-- name: ListHolidaysInRange :many
SELECT * FROM holidays
WHERE date BETWEEN $1 AND $2
ORDER BY date;

-- name: DeleteHoliday :exec
DELETE FROM holidays WHERE id = $1;

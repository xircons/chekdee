-- name: CreateCheckIn :one
INSERT INTO attendance_records
    (employee_id, work_date, check_in_at, check_in_lat, check_in_lng, check_in_accuracy_m, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAttendanceRecordByEmployeeAndDate :one
SELECT * FROM attendance_records
WHERE employee_id = $1 AND work_date = $2;

-- name: SetCheckOut :one
UPDATE attendance_records
SET check_out_at = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: AutoCloseAttendanceRecord :one
UPDATE attendance_records
SET check_out_at = $2, auto_closed = true, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListOpenAttendanceRecordsBeforeDate :many
-- Used by the end-of-day auto-close job.
SELECT * FROM attendance_records
WHERE check_out_at IS NULL AND work_date < $1;

-- name: CreateAttendanceCorrection :one
INSERT INTO attendance_corrections (attendance_record_id, corrected_by, field_name, old_value, new_value, reason)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListAttendanceCorrectionsForRecord :many
SELECT * FROM attendance_corrections
WHERE attendance_record_id = $1
ORDER BY created_at;

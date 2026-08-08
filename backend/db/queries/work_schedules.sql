-- name: CreateWorkSchedule :one
INSERT INTO work_schedules (employee_id, day_of_week, start_time, end_time, effective_from, effective_to)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListWorkSchedulesForEmployee :many
SELECT * FROM work_schedules
WHERE employee_id = $1
ORDER BY day_of_week, start_time;

-- name: DeleteWorkSchedule :exec
DELETE FROM work_schedules WHERE id = $1;

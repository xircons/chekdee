package repository

import (
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// mapNoRows translates pgx.ErrNoRows into the given domain-level
// not-found error, leaving any other error untouched.
func mapNoRows(err error, notFound error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound
	}
	return err
}

// Small conversion helpers between pgtype's wire-format types (what sqlc
// generates) and the plain Go types the domain layer uses — domain must
// stay storage-agnostic, so pgtype never leaks past this package.

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	s, _ := u.Value()
	str, _ := s.(string)
	return str
}

func uuidToStringPtr(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := uuidToString(u)
	return &s
}

func stringToUUID(s string) pgtype.UUID {
	var u pgtype.UUID
	_ = u.Scan(s)
	return u
}

func stringPtrToUUID(s *string) pgtype.UUID {
	if s == nil {
		return pgtype.UUID{}
	}
	return stringToUUID(*s)
}

func textToStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func stringPtrToText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func stringToText(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: s != ""}
}

func timestamptzToTimePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func timestamptzToTime(t pgtype.Timestamptz) time.Time {
	return t.Time
}

func timeToTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func timePtrToTimestamptz(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func dateToTime(d pgtype.Date) time.Time {
	return d.Time
}

func dateToTimePtr(d pgtype.Date) *time.Time {
	if !d.Valid {
		return nil
	}
	return &d.Time
}

func timeToDate(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

func timePtrToDate(t *time.Time) pgtype.Date {
	if t == nil {
		return pgtype.Date{}
	}
	return pgtype.Date{Time: *t, Valid: true}
}

func float8ToPtr(f pgtype.Float8) *float64 {
	if !f.Valid {
		return nil
	}
	return &f.Float64
}

func ptrToFloat8(f *float64) pgtype.Float8 {
	if f == nil {
		return pgtype.Float8{}
	}
	return pgtype.Float8{Float64: *f, Valid: true}
}

// pgtype.Time stores microseconds since midnight (no date component).
// Represented at the domain layer as a time.Time on the zero date —
// callers should only read the wall-clock fields (Hour/Minute/Second).
func timeOfDayToPgtype(t time.Time) pgtype.Time {
	midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	return pgtype.Time{Microseconds: t.Sub(midnight).Microseconds(), Valid: true}
}

func pgtypeToTimeOfDay(pt pgtype.Time) time.Time {
	return time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(pt.Microseconds) * time.Microsecond)
}

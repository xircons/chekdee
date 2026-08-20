package handler

import "testing"

// isKnownRole and uuidPattern gate GET/PATCH /employees's role/team_id
// inputs before they reach SQL — this is the pure logic behind the new
// 400-vs-500 behavior (an unknown role or malformed team_id used to reach
// Postgres as an enum/uuid cast error, surfacing as a 500).
func TestIsKnownRole(t *testing.T) {
	valid := []string{"employee", "supervisor", "admin", "system_owner"}
	for _, role := range valid {
		if !isKnownRole(role) {
			t.Errorf("isKnownRole(%q) = false, want true", role)
		}
	}

	invalid := []string{"", "boss", "Employee", " admin", "employee "}
	for _, role := range invalid {
		if isKnownRole(role) {
			t.Errorf("isKnownRole(%q) = true, want false", role)
		}
	}
}

func TestUUIDPattern(t *testing.T) {
	valid := []string{
		"550e8400-e29b-41d4-a716-446655440000",
		"00000000-0000-0000-0000-000000000000",
		"FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
	}
	for _, id := range valid {
		if !uuidPattern.MatchString(id) {
			t.Errorf("uuidPattern.MatchString(%q) = false, want true", id)
		}
	}

	invalid := []string{"", "not-a-uuid", "550e8400e29b41d4a716446655440000", "550e8400-e29b-41d4-a716-44665544000"}
	for _, id := range invalid {
		if uuidPattern.MatchString(id) {
			t.Errorf("uuidPattern.MatchString(%q) = true, want false", id)
		}
	}
}

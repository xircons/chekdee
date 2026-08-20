package usecase

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestScheduledTimeOn_IgnoresInputLocation is a regression test for a real
// bug: scheduledStart used to be built from checkInAt.Location() (the
// server process's ambient zone) instead of an explicit Asia/Bangkok. On a
// dev machine already set to Bangkok time this silently worked; on a
// UTC-configured production container it would have shifted every late/
// absent classification by the server's UTC offset. Two inputs carrying the
// same numeric H:M:S but different Locations must produce the identical
// Bangkok-anchored instant.
func TestScheduledTimeOn_IgnoresInputLocation(t *testing.T) {
	date := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)

	utcLabeled := time.Date(0, 1, 1, 9, 0, 0, 0, time.UTC)
	istLabeled := time.Date(0, 1, 1, 9, 0, 0, 0, time.FixedZone("IST", 5*3600+1800))

	fromUTC := scheduledTimeOn(date, utcLabeled)
	fromIST := scheduledTimeOn(date, istLabeled)

	require.True(t, fromUTC.Equal(fromIST), "the input time's Location must not affect the result")
	require.Equal(t, bangkokLocation(), fromUTC.Location())

	// And it must actually mean 09:00 Bangkok time, not 09:00 UTC.
	bangkok9am := time.Date(2026, 3, 2, 9, 0, 0, 0, bangkokLocation())
	require.True(t, fromUTC.Equal(bangkok9am))
}

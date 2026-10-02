package postgres

import (
	"strings"
	"testing"
	"time"
)

func TestUATFRowRejectsMandatoryNullAndDuplicateKey(t *testing.T) {
	valid := []any{"RA-001", "F", int16(1), int32(591), nil, nil, nil, time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)}
	if key, err := validateUATFRow(valid, nil); err != nil || key != "RA-001" {
		t.Fatalf("valid source row rejected: key=%q error=%v", key, err)
	}
	for _, index := range []int{0, 2, 7} {
		row := append([]any(nil), valid...)
		row[index] = nil
		if _, err := validateUATFRow(row, nil); err == nil || !strings.Contains(err.Error(), "mandatory") {
			t.Fatalf("mandatory null at index %d was accepted: %v", index, err)
		}
	}
	key := "RA-001"
	if _, err := validateUATFRow(valid, &key); err == nil {
		t.Fatal("duplicate natural key accepted")
	}
	// Go does not impose a binary ordering: PostgreSQL's validated unique
	// index and the query's own collation govern the keyset order.
	previous := "Z"
	if _, err := validateUATFRow(valid, &previous); err != nil {
		t.Fatalf("Go incorrectly imposed its own collation: %v", err)
	}
}

package source

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestUATFDatosContractAndApprovedQuery(t *testing.T) {
	if err := UATFDatosContract().Validate(); err != nil {
		t.Fatalf("invalid source contract: %v", err)
	}
	_, filename, _, _ := runtime.Caller(0)
	repositoryRoot := filepath.Clean(filepath.Join(filepath.Dir(filename), "..", "..", "..", ".."))
	query, err := LoadUATFDatosQuery(filepath.Join(repositoryRoot, "infra", "postgres-tx", "extract"))
	if err != nil {
		t.Fatalf("load approved query: %v", err)
	}
	if QuerySHA256(query) == "" {
		t.Fatal("query checksum is empty")
	}
}

func TestUATFDatosQueryLoaderRejectsNonContractSQL(t *testing.T) {
	directory := t.TempDir()
	for _, query := range []string{
		"DELETE FROM public.uatf_datos;",
		"SELECT * FROM public.uatf_datos JOIN public.postulantes USING (id_ra) ORDER BY id_ra ASC;",
		"SELECT id_ra FROM public.other_table ORDER BY id_ra ASC;",
	} {
		if err := os.WriteFile(filepath.Join(directory, UATFDatosContract().QueryFile), []byte(query), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadUATFDatosQuery(directory); err == nil {
			t.Fatalf("expected query rejection: %s", query)
		}
	}
}

func TestValidateUATFDatosSchemaAllowsFixtureIntegerWidening(t *testing.T) {
	names := UATFDatosExpectedColumns()
	types := []uint32{1043, 1043, 21, 23, 23, 23, 21, 1114}
	if err := ValidateUATFDatosSchema(names, types); err != nil {
		t.Fatalf("fixture schema should be accepted without narrowing integer values: %v", err)
	}
	types[0] = 25
	if err := ValidateUATFDatosSchema(names, types); err == nil {
		t.Fatal("unexpected source type must be rejected")
	}
}

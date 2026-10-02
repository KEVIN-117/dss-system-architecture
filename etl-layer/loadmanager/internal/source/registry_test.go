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
		"SELECT id_ra FROM public.uatf_datos ORDER BY id_ra ASC;",
		"SELECT id_ra FROM public.uatf_datos WHERE id_ra > $1 ORDER BY id_ra ASC LIMIT 100;",
		"SELECT id_ra, id_sexo, estado_civil, nac_pais, id_colegio, id_loc, egr_gestion, _modificado FROM public.uatf_datos WHERE ($1::varchar IS NULL OR id_ra > $1::varchar) AND id_ra LIKE 'A%' ORDER BY id_ra ASC LIMIT $2::integer;",
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

func TestUATFDatosMetadataRequiresDeclaredShapeAndUniqueKey(t *testing.T) {
	columns := []ColumnMetadata{
		{"id_ra", 1043, 14, true, "default"}, {"id_sexo", 1043, 5, false, "default"},
		{"estado_civil", 21, -1, true, ""}, {"nac_pais", 23, -1, false, ""},
		{"id_colegio", 23, -1, false, ""}, {"id_loc", 23, -1, false, ""},
		{"egr_gestion", 21, -1, false, ""}, {"_modificado", 1114, -1, true, ""},
	}
	if err := ValidateUATFDatosMetadata(columns, true); err != nil {
		t.Fatal(err)
	}
	if err := ValidateUATFDatosMetadata(columns, false); err == nil {
		t.Fatal("a non-unique natural key must be rejected")
	}
	columns[0].TypeModifier = 24
	if err := ValidateUATFDatosMetadata(columns, true); err == nil {
		t.Fatal("changed varchar length must be rejected")
	}
	columns[0].TypeModifier = 14
	columns[2].NotNull = false
	if err := ValidateUATFDatosMetadata(columns, true); err == nil {
		t.Fatal("nullable mandatory source field must be rejected")
	}
}

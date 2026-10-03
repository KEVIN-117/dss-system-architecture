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

func TestAllDW001ContractsLoadOnlyApprovedQueries(t *testing.T) {
	_, filename, _, _ := runtime.Caller(0)
	repositoryRoot := filepath.Clean(filepath.Join(filepath.Dir(filename), "..", "..", "..", ".."))
	queryDirectory := filepath.Join(repositoryRoot, "infra", "postgres-tx", "extract")
	queries, err := LoadApprovedQueries(queryDirectory)
	if err != nil {
		t.Fatal(err)
	}
	if len(queries) != 9 || len(Contracts()) != 9 {
		t.Fatalf("expected nine DW-001 sources, got %d approved queries and %d contracts", len(queries), len(Contracts()))
	}
	temporaryDirectory := t.TempDir()
	for _, spec := range Contracts() {
		if err := spec.Contract.Validate(); err != nil {
			t.Fatalf("contract %s is invalid: %v", spec.Contract.ID, err)
		}
		if _, ok := queries[spec.Contract.ID]; !ok {
			t.Errorf("approved query missing for %s", spec.Contract.ID)
		}
		if err := os.WriteFile(filepath.Join(temporaryDirectory, spec.Contract.QueryFile), queries[spec.Contract.ID], 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(temporaryDirectory, "09_localidades.sql"), []byte("SELECT cod_loc FROM public.lugar_localidad WHERE cod_loc > 0 ORDER BY cod_loc;"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadApprovedQueries(temporaryDirectory); err == nil {
		t.Fatal("modified query was accepted without contract version/hash approval")
	}
}

func TestValidateContractRowRejectsNullRequiredFieldsAndDuplicateNaturalKeys(t *testing.T) {
	contract, ok := ContractByID("public.postulantes")
	if !ok {
		t.Fatal("postulantes contract is missing")
	}
	columns := make([]string, len(contract.Contract.Columns))
	values := make([]any, len(columns))
	for index, column := range contract.Contract.Columns {
		columns[index] = column.Name
		values[index] = "sample"
	}
	values[0], values[1], values[2], values[3], values[4] = int32(7), "RA-7", "P01", int16(2025), int16(2)
	key, err := ValidateContractRow(contract.Contract, columns, values, "")
	if err != nil {
		t.Fatalf("valid contract row rejected: %v", err)
	}
	if _, err := ValidateContractRow(contract.Contract, columns, values, key); err == nil {
		t.Fatal("duplicate natural key was accepted")
	}
	values[1] = nil
	if _, err := ValidateContractRow(contract.Contract, columns, values, ""); err == nil {
		t.Fatal("null required field was accepted")
	}
}

func TestValidateContractTypeModifiersEnforcesDeclaredCharacterLengths(t *testing.T) {
	contract, ok := ContractByID("public.uatf_datos")
	if !ok {
		t.Fatal("uatf_datos contract is missing")
	}
	columns := make([]string, len(contract.Contract.Columns))
	modifiers := make([]int32, len(columns))
	for index, column := range contract.Contract.Columns {
		columns[index] = column.Name
	}
	modifiers[0], modifiers[1] = 14, 5 // varchar(10), varchar(1), including PostgreSQL's 4-byte varlena header.
	if err := ValidateContractTypeModifiers(contract.Contract, columns, modifiers); err != nil {
		t.Fatalf("declared column lengths rejected: %v", err)
	}
	modifiers[0] = 15
	if err := ValidateContractTypeModifiers(contract.Contract, columns, modifiers); err == nil {
		t.Fatal("incompatible source column length was accepted")
	}
}

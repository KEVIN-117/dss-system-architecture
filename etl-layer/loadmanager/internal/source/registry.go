package source

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
)

const UATFDatosContractID = "public.uatf_datos"

var uatfDatosColumns = []string{
	"id_ra", "id_sexo", "estado_civil", "nac_pais", "id_colegio", "id_loc", "egr_gestion", "_modificado",
}

// UATFDatosContract mirrors DW-001 contract 01. Contract approval against the
// live Jachasun instance remains a separate DSA/TI gate.
func UATFDatosContract() domain.SourceContract {
	return domain.SourceContract{
		ID: UATFDatosContractID, Version: "1", Schema: "public", Object: "uatf_datos",
		QueryFile: "01_uatf_datos.sql", StableOrder: []string{"id_ra"},
		SnapshotPolicy: domain.SnapshotFull,
		Columns: []domain.SourceColumn{
			{Name: "id_ra", DataType: "varchar(10)", Nullable: false, Classification: domain.ClassificationPersonal},
			{Name: "id_sexo", DataType: "varchar(1)", Nullable: true, Classification: domain.ClassificationPersonal},
			{Name: "estado_civil", DataType: "smallint", Nullable: false, Classification: domain.ClassificationPersonal},
			{Name: "nac_pais", DataType: "integer", Nullable: true, Classification: domain.ClassificationPersonal},
			{Name: "id_colegio", DataType: "smallint", Nullable: true, Classification: domain.ClassificationPersonal},
			{Name: "id_loc", DataType: "smallint", Nullable: true, Classification: domain.ClassificationPersonal},
			{Name: "egr_gestion", DataType: "smallint", Nullable: true, Classification: domain.ClassificationPersonal},
			{Name: "_modificado", DataType: "timestamp", Nullable: false, Classification: domain.ClassificationInternal},
		},
	}
}

func LoadUATFDatosQuery(directory string) ([]byte, error) {
	if strings.TrimSpace(directory) == "" {
		return nil, errors.New("source query directory is required")
	}
	queryPath := filepath.Join(directory, UATFDatosContract().QueryFile)
	query, err := os.ReadFile(queryPath)
	if err != nil {
		return nil, fmt.Errorf("read approved source query: %w", err)
	}
	return ValidateUATFDatosQuery(query)
}

func ValidateUATFDatosQuery(query []byte) ([]byte, error) {
	normalized := strings.TrimSpace(strings.ReplaceAll(string(query), "\r\n", "\n"))
	if normalized == "" {
		return nil, errors.New("source query is empty")
	}
	statement := make([]string, 0, 12)
	for _, line := range strings.Split(normalized, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" && !strings.HasPrefix(trimmed, "--") {
			statement = append(statement, trimmed)
		}
	}
	selectSQL := strings.ToLower(strings.Join(statement, " "))
	if !strings.HasPrefix(selectSQL, "select") || strings.Count(normalized, ";") > 1 ||
		!strings.Contains(selectSQL, "from public.uatf_datos") || !strings.Contains(selectSQL, "order by id_ra asc") {
		return nil, errors.New("source query does not match the approved read-only contract")
	}
	for _, forbidden := range []string{"insert ", "update ", "delete ", "truncate ", "drop ", "alter ", "create ", " join "} {
		if strings.Contains(selectSQL, forbidden) {
			return nil, errors.New("source query contains a forbidden operation")
		}
	}
	return []byte(normalized), nil
}

func QuerySHA256(query []byte) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(strings.ReplaceAll(string(query), "\r\n", "\n"))))
}

func UATFDatosExpectedColumns() []string {
	return append([]string(nil), uatfDatosColumns...)
}

func ValidateUATFDatosSchema(names []string, typeOIDs []uint32) error {
	if len(names) != len(uatfDatosColumns) || len(typeOIDs) != len(uatfDatosColumns) {
		return errors.New("observed source schema has an unexpected column count")
	}
	expectedOIDs := [][]uint32{{1043}, {1043}, {21}, {23}, {21, 23}, {21, 23}, {21}, {1114}}
	for index, name := range uatfDatosColumns {
		if names[index] != name {
			return fmt.Errorf("observed source column %d does not match the approved order", index+1)
		}
		allowed := false
		for _, oid := range expectedOIDs[index] {
			allowed = allowed || typeOIDs[index] == oid
		}
		if !allowed {
			return fmt.Errorf("observed source type for column %s does not match the approved contract", name)
		}
	}
	return nil
}

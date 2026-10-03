package source

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
)

type ContractSpec struct {
	Contract domain.SourceContract
	QuerySHA string
}

func column(name, typ string, nullable bool, class domain.DataClassification, oids ...uint32) domain.SourceColumn {
	return domain.SourceColumn{Name: name, DataType: typ, Nullable: nullable, Classification: class, ExpectedTypeOIDs: oids}
}

var contracts = []ContractSpec{
	{domain.SourceContract{ID: "public.uatf_datos", Version: "1", Schema: "public", Object: "uatf_datos", QueryFile: "01_uatf_datos.sql", StableOrder: []string{"id_ra"}, SnapshotPolicy: domain.SnapshotFull, Columns: []domain.SourceColumn{
		column("id_ra", "varchar(10)", false, domain.ClassificationPersonal, 1043), column("id_sexo", "varchar(1)", true, domain.ClassificationPersonal, 1043), column("estado_civil", "smallint", false, domain.ClassificationPersonal, 21), column("nac_pais", "integer", true, domain.ClassificationPersonal, 23), column("id_colegio", "smallint", true, domain.ClassificationPersonal, 21, 23), column("id_loc", "smallint", true, domain.ClassificationPersonal, 21, 23), column("egr_gestion", "smallint", true, domain.ClassificationPersonal, 21), column("_modificado", "timestamp", false, domain.ClassificationInternal, 1114),
	}}, "61518492c7c7d9d92fbc64902fcc6ec974d0676999902f2cb7c40bdfccd56ae8"},
	{domain.SourceContract{ID: "academico.alumnos", Version: "1", Schema: "academico", Object: "alumnos", QueryFile: "02_alumnos.sql", StableOrder: []string{"id_alumno"}, SnapshotPolicy: domain.SnapshotFull, Columns: []domain.SourceColumn{
		column("id_alumno", "integer", false, domain.ClassificationInternal, 23), column("id_programa", "char(3)", false, domain.ClassificationInternal, 1042), column("id_ra", "varchar(10)", true, domain.ClassificationPersonal, 1043), column("fec_inscripcion", "date", false, domain.ClassificationInternal, 1082), column("fec_egreso", "date", true, domain.ClassificationInternal, 1082), column("id_plan", "smallint", true, domain.ClassificationInternal, 21), column("estado", "char(1)", false, domain.ClassificationInternal, 1042), column("tipo_alumno", "char(1)", false, domain.ClassificationInternal, 1042), column("_fecha_registro", "timestamp", true, domain.ClassificationInternal, 1114),
	}}, "9bee2a6211e3251598ecc94a3ad25bcf4d308023e9178cf38178c1b6d4df46a6"},
	{domain.SourceContract{ID: "public.postulantes", Version: "1", Schema: "public", Object: "postulantes", QueryFile: "03_postulantes.sql", StableOrder: []string{"id_gestion", "id_periodo", "id_alumno"}, SnapshotPolicy: domain.SnapshotAcademicCut, Columns: []domain.SourceColumn{
		column("id_alumno", "integer", false, domain.ClassificationInternal, 23), column("id_ra", "varchar(10)", false, domain.ClassificationPersonal, 1043), column("id_programa", "char(3)", false, domain.ClassificationInternal, 1042), column("id_gestion", "smallint", true, domain.ClassificationInternal, 21), column("id_periodo", "smallint", true, domain.ClassificationInternal, 21), column("id_acceso", "char(2)", true, domain.ClassificationInternal, 1042), column("nota", "integer", true, domain.ClassificationInternal, 23), column("estado", "char(1)", true, domain.ClassificationInternal, 1042), column("fec_inscripcion", "date", true, domain.ClassificationInternal, 1082), column("_modificado", "timestamp", false, domain.ClassificationInternal, 1114),
	}}, "1022d5610db9cfbb663224876c2203971bef528725df8f83b3a9d904d654de0c"},
	{domain.SourceContract{ID: "academico.alm_programas", Version: "1", Schema: "academico", Object: "alm_programas", QueryFile: "04_programas.sql", StableOrder: []string{"id_programa"}, SnapshotPolicy: domain.SnapshotFull, Columns: []domain.SourceColumn{
		column("id_programa", "char(3)", false, domain.ClassificationInternal, 1042), column("programa", "varchar", false, domain.ClassificationInternal, 1043), column("id_facultad", "smallint", false, domain.ClassificationInternal, 21), column("id_nivel", "smallint", true, domain.ClassificationInternal, 21), column("nivel", "varchar", true, domain.ClassificationInternal, 1043), column("sede", "varchar(1)", true, domain.ClassificationInternal, 1043), column("_tipo_academico", "char(3)", false, domain.ClassificationInternal, 1042), column("activo", "varchar", true, domain.ClassificationInternal, 1043),
	}}, "028e8834faa36d6f2110e200536e05a916094bd48d91a91a454a18430d7ecc21"},
	{domain.SourceContract{ID: "academico.pln_materias", Version: "1", Schema: "academico", Object: "pln_materias", QueryFile: "05_materias.sql", StableOrder: []string{"id_materia"}, SnapshotPolicy: domain.SnapshotFull, Columns: []domain.SourceColumn{
		column("id_materia", "integer", false, domain.ClassificationInternal, 23), column("sigla", "varchar", false, domain.ClassificationInternal, 1043), column("materia", "varchar", false, domain.ClassificationInternal, 1043), column("id_programa", "char(3)", true, domain.ClassificationInternal, 1042), column("id_plan", "integer", true, domain.ClassificationInternal, 23), column("id_materia_padre", "integer", true, domain.ClassificationInternal, 23), column("ciclo", "integer", true, domain.ClassificationInternal, 23), column("nivel_academico", "smallint", true, domain.ClassificationInternal, 21), column("hrs_teoricas", "numeric", true, domain.ClassificationInternal, 1700), column("hrs_practicas", "numeric", true, domain.ClassificationInternal, 1700), column("creditos", "numeric", true, domain.ClassificationInternal, 1700),
	}}, "c1750a1f3ccf632789c09bea3cfe3d87d81d3631448736ee84b36bc416728507"},
	{domain.SourceContract{ID: "academico.notas_planilla", Version: "1", Schema: "academico", Object: "notas_planilla", QueryFile: "06_notas_planilla.sql", StableOrder: []string{"id_gestion", "id_periodo", "id_matricula"}, SnapshotPolicy: domain.SnapshotAcademicCut, Columns: []domain.SourceColumn{
		column("id_matricula", "integer", false, domain.ClassificationInternal, 20, 23), column("id_gestion", "smallint", false, domain.ClassificationInternal, 21), column("id_periodo", "smallint", false, domain.ClassificationInternal, 21), column("id_alumno", "integer", false, domain.ClassificationInternal, 23), column("id_materia", "smallint", false, domain.ClassificationInternal, 21, 23), column("grupo", "smallint", true, domain.ClassificationInternal, 21, 1043), column("nota", "numeric", true, domain.ClassificationInternal, 23, 1700), column("nota_2da", "numeric", true, domain.ClassificationInternal, 23, 1700), column("nota_ex_mesa", "numeric", true, domain.ClassificationInternal, 23, 1700), column("pparcial", "numeric", true, domain.ClassificationInternal, 23, 1700), column("sparcial", "numeric", true, domain.ClassificationInternal, 23, 1700), column("tparcial", "numeric", true, domain.ClassificationInternal, 23, 1700), column("cparcial", "numeric", true, domain.ClassificationInternal, 23, 1700), column("estado", "char(1)", true, domain.ClassificationInternal, 1042), column("observacion", "text", true, domain.ClassificationInternal, 1043, 25), column("tipo", "char(1)", true, domain.ClassificationInternal, 1042), column("_fecha_creacion", "timestamp", true, domain.ClassificationInternal, 1114), column("_hash", "text", true, domain.ClassificationInternal, 25, 1043),
	}}, "7d6aa876ac9fd984d4d12637c4d4d25319954ea06f432571e9d99862ede9410c"},
	{domain.SourceContract{ID: "academico.alm_programas_facultades", Version: "1", Schema: "academico", Object: "alm_programas_facultades", QueryFile: "07_facultades.sql", StableOrder: []string{"id_facultad"}, SnapshotPolicy: domain.SnapshotFull, Columns: []domain.SourceColumn{
		column("id_facultad", "integer", false, domain.ClassificationInternal, 23), column("facultad", "varchar(100)", false, domain.ClassificationInternal, 1043), column("facu_abre", "varchar(50)", true, domain.ClassificationInternal, 1043), column("estado", "char(1)", true, domain.ClassificationInternal, 1042),
	}}, "de4350cc8098c8b5dcfb698c007b44c165b1572e7eb6331ebb6ed2611e76043e"},
	{domain.SourceContract{ID: "public.prs_colegios", Version: "1", Schema: "public", Object: "prs_colegios", QueryFile: "08_colegios.sql", StableOrder: []string{"id_colegio"}, SnapshotPolicy: domain.SnapshotFull, Columns: []domain.SourceColumn{
		column("id_colegio", "integer", false, domain.ClassificationInternal, 23), column("colegio", "varchar(65)", false, domain.ClassificationInternal, 1043), column("tipo", "char(1)", false, domain.ClassificationInternal, 1042), column("turno", "char(1)", false, domain.ClassificationInternal, 1042), column("area", "char(1)", false, domain.ClassificationInternal, 1042), column("cod_loc", "smallint", false, domain.ClassificationInternal, 21), column("_estado", "char(1)", false, domain.ClassificationInternal, 1042),
	}}, "9c462d8c9112a4e37dffcd9a02dbf3c123cda1e852da1ce831c77b599ce74418"},
	{domain.SourceContract{ID: "public.lugar_localidad", Version: "1", Schema: "public", Object: "lugar_localidad", QueryFile: "09_localidades.sql", StableOrder: []string{"cod_loc"}, SnapshotPolicy: domain.SnapshotFull, Columns: []domain.SourceColumn{
		column("cod_loc", "integer", false, domain.ClassificationInternal, 23), column("localidad", "varchar", true, domain.ClassificationInternal, 1043), column("cod_pais", "integer", true, domain.ClassificationInternal, 23), column("cod_dep", "integer", true, domain.ClassificationInternal, 23), column("cod_prov", "integer", true, domain.ClassificationInternal, 23),
	}}, "1fb350842c7a3a816eef825d9f431e3ae1cbd0d9845f46bd85d009799bde5b6d"},
}

var sizedCharacterType = regexp.MustCompile(`^(?:varchar|char)\(([0-9]+)\)$`)

func Contracts() []ContractSpec {
	result := make([]ContractSpec, len(contracts))
	copy(result, contracts)
	return result
}

func ContractByID(id string) (ContractSpec, bool) {
	for _, item := range contracts {
		if item.Contract.ID == id {
			return item, true
		}
	}
	return ContractSpec{}, false
}

func LoadApprovedQueries(directory string) (map[string][]byte, error) {
	if strings.TrimSpace(directory) == "" {
		return nil, errors.New("source query directory is required")
	}
	loaded := make(map[string][]byte, len(contracts))
	for _, item := range contracts {
		query, err := os.ReadFile(filepath.Join(directory, item.Contract.QueryFile))
		if err != nil {
			return nil, fmt.Errorf("read query for %s: %w", item.Contract.ID, err)
		}
		normalized := []byte(strings.TrimSpace(strings.ReplaceAll(string(query), "\r\n", "\n")))
		if QuerySHA256(normalized) != item.QuerySHA {
			return nil, fmt.Errorf("query for %s differs from its approved version", item.Contract.ID)
		}
		loaded[item.Contract.ID] = normalized
	}
	return loaded, nil
}

func ValidateContractColumns(contract domain.SourceContract, names []string, oids []uint32) error {
	if len(names) != len(contract.Columns) || len(oids) != len(contract.Columns) {
		return fmt.Errorf("query projection for %s differs from its contract", contract.ID)
	}
	for index, expected := range contract.Columns {
		if names[index] != expected.Name {
			return fmt.Errorf("query projection for %s has an unexpected column at position %d", contract.ID, index+1)
		}
		allowed := false
		for _, oid := range expected.ExpectedTypeOIDs {
			allowed = allowed || oid == oids[index]
		}
		if !allowed {
			return fmt.Errorf("query result type for %s.%s differs from the approved fixture-compatible contract", contract.ID, expected.Name)
		}
	}
	return nil
}

func ValidateContractTypeModifiers(contract domain.SourceContract, names []string, modifiers []int32) error {
	if len(names) != len(contract.Columns) || len(modifiers) != len(contract.Columns) {
		return fmt.Errorf("query metadata for %s differs from its contract", contract.ID)
	}
	for index, expected := range contract.Columns {
		match := sizedCharacterType.FindStringSubmatch(strings.ToLower(expected.DataType))
		if match == nil {
			continue
		}
		length, err := strconv.Atoi(match[1])
		if err != nil || modifiers[index] != int32(length+4) {
			return fmt.Errorf("query result length for %s.%s differs from the approved contract", contract.ID, expected.Name)
		}
	}
	return nil
}

// ValidateContractRow checks required fields and rejects adjacent duplicate
// natural keys. Queries are ordered by their approved SQL collation, so this
// check deliberately compares equality only and does not impose Go ordering.
func ValidateContractRow(contract domain.SourceContract, columns []string, values []any, previousKey string) (string, error) {
	if len(values) != len(contract.Columns) || len(columns) != len(contract.Columns) {
		return "", fmt.Errorf("row projection for %s differs from its contract", contract.ID)
	}
	indices := make(map[string]int, len(columns))
	for index, name := range columns {
		indices[name] = index
		if !contract.Columns[index].Nullable && values[index] == nil {
			return "", fmt.Errorf("required field %s.%s is null", contract.ID, name)
		}
	}
	key := make([]any, 0, len(contract.StableOrder))
	for _, name := range contract.StableOrder {
		index, ok := indices[name]
		if !ok || values[index] == nil {
			return "", fmt.Errorf("natural key %s.%s is missing", contract.ID, name)
		}
		value := values[index]
		if text, ok := value.(string); ok {
			value = strings.TrimRight(text, " ")
		}
		key = append(key, value)
	}
	encoded, err := json.Marshal(key)
	if err != nil {
		return "", fmt.Errorf("could not encode natural key for %s", contract.ID)
	}
	keyText := string(encoded)
	if previousKey != "" && previousKey == keyText {
		return "", fmt.Errorf("duplicate natural key in %s snapshot", contract.ID)
	}
	return keyText, nil
}

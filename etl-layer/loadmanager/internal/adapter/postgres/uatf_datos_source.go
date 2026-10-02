package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

func validateUATFRow(values []any, previousKey *string) (string, error) {
	if len(values) != 8 || values[0] == nil || values[2] == nil || values[7] == nil {
		return "", errors.New("source row violates mandatory contract fields")
	}
	key, ok := values[0].(string)
	if !ok || strings.TrimSpace(key) == "" || (previousKey != nil && key == *previousKey) {
		return "", errors.New("source natural key is missing or duplicated")
	}
	return key, nil
}

// inspectUATFSource runs under the same REPEATABLE READ transaction as pages.
// It checks the table catalog, not only the result-set OIDs (which omit typmod
// and nullability), and captures the effective database collation in the hash.
func inspectUATFSource(ctx context.Context, tx pgx.Tx) (string, error) {
	rows, err := tx.Query(ctx, `SELECT a.attname, a.atttypid::bigint, a.atttypmod, a.attnotnull,
       CASE WHEN a.attcollation = 0 THEN '' ELSE c.collname::text || ':' || c.collprovider::text || ':' || coalesce(c.collversion, '') END
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class t ON t.oid = a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
LEFT JOIN pg_catalog.pg_collation c ON c.oid = a.attcollation
WHERE n.nspname = 'public' AND t.relname = 'uatf_datos'
  AND a.attname = ANY($1::text[]) AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY array_position($1::text[], a.attname)`, source.UATFDatosExpectedColumns())
	if err != nil {
		return "", errors.New("could not inspect source catalog")
	}
	var columns []source.ColumnMetadata
	for rows.Next() {
		var column source.ColumnMetadata
		var oid int64
		if err := rows.Scan(&column.Name, &oid, &column.TypeModifier, &column.NotNull, &column.Collation); err != nil {
			rows.Close()
			return "", errors.New("could not decode source catalog")
		}
		column.TypeOID = uint32(oid)
		columns = append(columns, column)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return "", errors.New("source catalog inspection failed")
	}
	rows.Close()
	var uniqueKey bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (
  SELECT 1 FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
  WHERE i.indrelid = 'public.uatf_datos'::regclass AND a.attname = 'id_ra'
    AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts = 1
    AND i.indcollation[0] = a.attcollation
    AND i.indpred IS NULL AND i.indexprs IS NULL
)`).Scan(&uniqueKey); err != nil {
		return "", errors.New("could not inspect source key uniqueness")
	}
	if err := source.ValidateUATFDatosMetadata(columns, uniqueKey); err != nil {
		return "", err
	}
	var databaseCollation string
	if err := tx.QueryRow(ctx, `SELECT datcollate || ':' || datctype FROM pg_catalog.pg_database WHERE datname = current_database()`).Scan(&databaseCollation); err != nil {
		return "", errors.New("could not inspect database collation")
	}
	descriptor, err := json.Marshal(struct {
		Columns           []source.ColumnMetadata `json:"columns"`
		DatabaseCollation string                  `json:"database_collation"`
	}{columns, databaseCollation})
	if err != nil {
		return "", errors.New("could not fingerprint source schema")
	}
	return fmt.Sprintf("%x", sha256.Sum256(descriptor)), nil
}

#!/bin/sh
# Pipeline del dataset OLTP sintético: generar → cargar → validar → exportar → sellar.
# Variables: DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME SEED PROFILE SCENARIO
#            START_YEAR END_YEAR COHORT_SIZE (opcional) OUT_DIR
set -eu

export PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" PGPASSWORD="$DB_PASSWORD" PGDATABASE="$DB_NAME"
DATASET_ID="uatf-seed-${SCENARIO}-s${SEED}-${PROFILE}"
DATASET_DIR="${OUT_DIR}/${DATASET_ID}"
PSQL="psql -X -q -v ON_ERROR_STOP=1"

log() { printf '\n\033[1;36m[seed-pipeline]\033[0m %s\n' "$*"; }

# Guarda: solo bases de prueba aisladas (el SQL con --clean la vuelve a verificar).
if [ "$DB_NAME" != "jachasun_test" ]; then
  echo "Se rechaza DB_NAME=$DB_NAME: el pipeline solo carga en jachasun_test." >&2
  exit 1
fi

log "1/5 Generando escenario '${SCENARIO}' (perfil ${PROFILE}, semilla ${SEED}, ${START_YEAR}-${END_YEAR})"
rm -rf "$DATASET_DIR"
mkdir -p "$DATASET_DIR/oltp"
set -- --profile "$PROFILE" --seed "$SEED" --scenario "$SCENARIO" \
  --start-year "$START_YEAR" --end-year "$END_YEAR" \
  --catalogs-dir /app/catalogs --export-dir "$DATASET_DIR" --clean
if [ -n "${COHORT_SIZE:-}" ]; then set -- "$@" --cohort-size "$COHORT_SIZE"; fi
bun dist/cli.js "$@"

log "2/5 Cargando OLTP (${DB_NAME}@${DB_HOST}) en una sola transacción"
$PSQL -f "$DATASET_DIR/sql/seed_oltp.sql"
$PSQL -c "ANALYZE"

log "3/5 Validando integridad y narrativa del escenario"
$PSQL -v scenario="$SCENARIO" -f /app/docker/validate_seed.sql

log "4/5 Exportando tablas pobladas a CSV (RFC 4180, UTF-8)"
TABLES="public.prs_pais_v2 public._bp_estados_civiles public.prs_calificacion public.prs_examen
public.lugar_departamento public.lugar_provincia public.lugar_localidad public.prs_colegios
academico.carreras_tipos academico.sedes academico.alumnos_estados academico.periodos
academico.alm_periodos academico.docentes_tiempo academico.alm_programas_facultades
academico.alm_programas academico.docentes academico.pln_materias academico.dct_asignaciones
public.uatf_datos public.postulantes academico.alumnos public.matriculas
public.cajas_transacciones public.valores_transacciones academico.alm_programaciones
academico.notas_planilla actas_graduacion.graduados"

for t in $TABLES; do
  schema="${t%%.*}"; table="${t#*.}"
  # Solo columnas con al menos un valor: el DDL Jachasun tiene muchas columnas
  # que el seed no puebla y que solo añadirían ruido al dataset.
  cols=$(psql -X -At -c "
    SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = '$schema' AND table_name = '$table'")
  counts=$(psql -X -At -c "SELECT concat_ws(',', $(echo "$cols" | sed 's/[^,][^,]*/count(&)::text/g')) FROM $t")
  keep=$(printf '%s\n%s\n' "$cols" "$counts" | awk -F, '
    NR == 1 { n = NF; for (i = 1; i <= NF; i++) c[i] = $i }
    NR == 2 { for (i = 1; i <= n; i++) if ($i != "0") o = o (o ? "," : "") c[i]; print o }')
  if [ -z "$keep" ]; then keep="$cols"; fi
  psql -X -q -c "\\copy (SELECT $keep FROM $t ORDER BY 1, 2) TO '$DATASET_DIR/oltp/$t.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
  printf '  %-40s %8s filas\n' "$t" "$(psql -X -At -c "SELECT count(*) FROM $t")"
done

log "5/5 Sellando manifiesto (sha256, filas y columnas por archivo)"
bun dist/export/build-manifest.js "$DATASET_DIR"

log "Dataset listo: out/dataset/${DATASET_ID}"
log "OLTP disponible para Hop: jdbc:postgresql://localhost:55433/jachasun_test (dw_fixture_reader / solo lectura)"

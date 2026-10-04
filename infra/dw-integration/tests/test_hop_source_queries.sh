#!/bin/sh
set -eu

assert_query_count() {
    contract="$1"
    filename="$2"
    expected="$3"
    query_file="/queries/$filename"

    [ -r "$query_file" ] || {
        echo "Missing source query for $contract: $filename" >&2
        exit 1
    }

    # The fixture test exercises the historical/full-snapshot path. Replace
    # only JDBC bind markers with typed NULL values, making the optional cut
    # predicates include all available synthetic rows.
    query=$(sed 's/?/NULL/g' "$query_file")
    query=${query%;}
    actual=$(psql -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM ($query) AS source_rows")
    if [ "$actual" != "$expected" ]; then
        echo "$contract returned $actual rows; expected $expected" >&2
        exit 1
    fi
    echo "PASS $contract: $actual rows as dw_fixture_reader"
}

assert_unique_key() {
    contract="$1"
    key_columns="$2"
    duplicate_groups=$(psql -X -v ON_ERROR_STOP=1 -Atc \
        "SELECT count(*) FROM (SELECT $key_columns FROM $contract GROUP BY $key_columns HAVING count(*) > 1) d")
    if [ "$duplicate_groups" != "0" ]; then
        echo "$contract has $duplicate_groups duplicate natural-key groups ($key_columns)" >&2
        exit 1
    fi
    echo "PASS $contract: no duplicate groups for ($key_columns)"
}

assert_query_count "public.uatf_datos" "select_uatf_datos_vertical.sql" 2002
assert_query_count "academico.alumnos" "select_alumnos.sql" 3
assert_query_count "public.postulantes" "select_postulantes.sql" 4
assert_query_count "academico.alm_programas" "select_programas.sql" 2
assert_query_count "academico.pln_materias" "select_materias.sql" 3
assert_query_count "academico.notas_planilla" "select_notas_planilla.sql" 5
assert_query_count "academico.alm_programas_facultades" "select_facultades.sql" 2
assert_query_count "public.prs_colegios" "select_colegios.sql" 2
assert_query_count "public.lugar_localidad" "select_localidades.sql" 2

for filename in select_postulantes.sql select_notas_planilla.sql; do
    query=$(sed -e 's/?::smallint/2025::smallint/' \
        -e 's/?::smallint/2025::smallint/' \
        -e 's/?::smallint/1::smallint/' "/queries/$filename")
    query=${query%;}
    actual=$(psql -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM ($query) AS cut_rows")
    if [ "$actual" != "2" ]; then
        echo "$filename returned $actual rows through academic cut (2025, 1); expected 2" >&2
        exit 1
    fi
    echo "PASS $filename: cut filter (2025, 1) returned $actual rows"
done

assert_unique_key "public.uatf_datos" "id_ra"
assert_unique_key "academico.alumnos" "id_alumno"
assert_unique_key "public.postulantes" "id_alumno, id_programa, id_gestion, id_periodo"
assert_unique_key "academico.alm_programas" "id_programa"
assert_unique_key "academico.pln_materias" "id_materia"
assert_unique_key "academico.notas_planilla" "id_matricula"
assert_unique_key "academico.alm_programas_facultades" "id_facultad"
assert_unique_key "public.prs_colegios" "id_colegio"
assert_unique_key "public.lugar_localidad" "cod_loc"

echo "All nine read-only source queries passed against the synthetic Jachasun fixture."

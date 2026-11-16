#!/usr/bin/env bash
# Extrae del DW un dataset de deserción listo para subir al portal admin.
#
# Uso (Git Bash, desde cualquier carpeta):
#   bash prediction-service/scripts/extraer_dataset_dw.sh \
#       --cadencia SEMESTRAL --horizonte 4 --salida outputs/datasets/desercion-4a \
#       [--ref-objetivo dsa:objetivo:AAAA-NNN:vN --ref-poblacion dsa:poblacion:AAAA-NNN:vN]
#
# Sin referencias, el dataset sale NO aprobado: sirve para exploración, pero el
# portal lo rechaza. Con referencias, cada una tiene que estar registrada con
# estado APROBADA en docs/prediction/decisiones-dsa/README.md. El script no
# acepta una referencia que no esté en el registro.
# Al terminar deja también <salida>.zip, listo para subir.
set -euo pipefail

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }
die() { echo "ERROR: $*" >&2; exit 1; }

CADENCIA="" HORIZONTE="" SALIDA="" REF_OBJ="" REF_POB=""
while [ $# -gt 0 ]; do
    case "$1" in
        --cadencia) CADENCIA="${2:-}"; shift 2 ;;
        --horizonte) HORIZONTE="${2:-}"; shift 2 ;;
        --salida) SALIDA="${2:-}"; shift 2 ;;
        --ref-objetivo) REF_OBJ="${2:-}"; shift 2 ;;
        --ref-poblacion) REF_POB="${2:-}"; shift 2 ;;
        -h|--help) usage 0 ;;
        *) echo "Opción desconocida: $1" >&2; usage ;;
    esac
done

case "$CADENCIA" in
    SEMESTRAL) REGIMEN=S ;;
    ANUAL) REGIMEN=A ;;
    *) die "--cadencia debe ser SEMESTRAL o ANUAL" ;;
esac
[ -n "$SALIDA" ] || die "falta --salida <carpeta nueva>"
[ -z "$HORIZONTE" ] || [[ "$HORIZONTE" =~ ^[1-9][0-9]*$ ]] || die "--horizonte debe ser un entero positivo (años)"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRO="$REPO/docs/prediction/decisiones-dsa/README.md"
case "$SALIDA" in /*|[A-Za-z]:*) ;; *) SALIDA="$PWD/$SALIDA" ;; esac
[ ! -e "$SALIDA" ] || die "la carpeta de salida ya existe: $SALIDA (los datasets no se sobrescriben)"

# Una referencia solo es válida si el registro DSA la tiene con estado APROBADA.
ref_aprobada() {
    local ref="$1" tipo="$2"
    [[ "$ref" == "dsa:$tipo:"* ]] || die "la referencia '$ref' debe empezar con dsa:$tipo:"
    awk -F'|' -v ref="$ref" '
        { gsub(/[ `]/, "", $2); gsub(/ /, "", $5) }
        $2 == ref && $5 == "APROBADA" { found = 1 }
        END { exit !found }' "$REGISTRO" \
        || die "'$ref' no está registrada como APROBADA en docs/prediction/decisiones-dsa/README.md. No se puede marcar el dataset como aprobado sin una decisión DSA registrada."
}

APROBACION=()
if [ -n "$REF_OBJ$REF_POB" ]; then
    [ -n "$REF_OBJ" ] && [ -n "$REF_POB" ] || die "pasa las dos referencias (--ref-objetivo y --ref-poblacion), o ninguna"
    ref_aprobada "$REF_OBJ" objetivo
    ref_aprobada "$REF_POB" poblacion
    APROBACION=(--dsa-approved --target-definition-ref "$REF_OBJ" --population-definition-ref "$REF_POB")
    echo "Referencias verificadas en el registro DSA."
else
    echo "AVISO: sin referencias DSA. El dataset saldrá NO aprobado (solo exploración; el portal lo rechazará)."
fi

docker exec postgres-dw true 2>/dev/null || die "el contenedor postgres-dw no está corriendo"

# Lista de carreras de la cadencia. Se pasa como arreglo para no depender de la división de palabras.
mapfile -t CARRERAS < <(docker exec -i postgres-dw sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -At -v ON_ERROR_STOP=1 -v regimen="$1" -f -' sh "$REGIMEN" <<'SQL' | tr -d '\r'
SELECT id_programa FROM dw.dim_programa
WHERE member_type = 'STANDARD' AND regimen = :'regimen'
ORDER BY id_programa;
SQL
)
[ "${#CARRERAS[@]}" -gt 0 ] || die "el DW no tiene carreras con régimen $REGIMEN"
PROGRAMAS=()
for c in "${CARRERAS[@]}"; do [ -n "$c" ] && PROGRAMAS+=(--program "$c"); done
echo "Carreras ($CADENCIA): ${#CARRERAS[@]}"

# Conexión al DW: las credenciales se leen del contenedor y no se muestran.
DW_USER="$(docker exec postgres-dw printenv POSTGRES_USER | tr -d '\r')"
DW_PASS="$(docker exec postgres-dw printenv POSTGRES_PASSWORD | tr -d '\r')"
DW_DB="$(docker exec postgres-dw printenv POSTGRES_DB | tr -d '\r')"
export PREDICTION_DW_DATABASE_URL="postgresql://$DW_USER:$DW_PASS@localhost:5434/$DW_DB"
unset DW_PASS

HORIZONTE_ARGS=()
[ -z "$HORIZONTE" ] || HORIZONTE_ARGS=(--dropout-horizon-years "$HORIZONTE")

mkdir -p "$(dirname "$SALIDA")"
cd "$REPO/prediction-service"
echo "Extrayendo... (puede tardar 15-20 minutos con el historial completo)"
uv run --frozen python -m training.dw_extract --cadence "$CADENCIA" "${PROGRAMAS[@]}" \
    "${HORIZONTE_ARGS[@]}" "${APROBACION[@]}" --output "$SALIDA"

# El .zip debe tener manifest.json y rows.jsonl en la raíz.
python - "$SALIDA" <<'PY'
import sys, zipfile
from pathlib import Path
src = Path(sys.argv[1])
with zipfile.ZipFile(src.with_suffix(".zip"), "w", zipfile.ZIP_DEFLATED) as z:
    for name in ("manifest.json", "rows.jsonl"):
        z.write(src / name, arcname=name)
PY
echo "Listo: $SALIDA ($(wc -l < "$SALIDA/rows.jsonl") filas) y $SALIDA.zip"

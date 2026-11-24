#!/usr/bin/env bash
# Extrae del DW un dataset de deserción listo para subir al portal admin.
#
# Uso (Git Bash, desde cualquier carpeta):
#   bash prediction-service/scripts/extraer_dataset_dw.sh \
#       --cadencia SEMESTRAL --horizonte 4 --salida outputs/datasets/desercion-4a \
#       [--ref-objetivo <ref> --ref-poblacion <ref>]
#
# El objetivo y la población salen del catálogo de tareas (ml_tasks): no se
# requiere aprobación DSA. Las referencias opcionales solo reemplazan las
# referencias catalog: por defecto.
# Al terminar deja también <salida>.zip, listo para subir.
set -euo pipefail

usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }
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
case "$SALIDA" in /*|[A-Za-z]:*) ;; *) SALIDA="$PWD/$SALIDA" ;; esac
[ ! -e "$SALIDA" ] || die "la carpeta de salida ya existe: $SALIDA (los datasets no se sobrescriben)"

APROBACION=()
[ -z "$REF_OBJ" ] || APROBACION+=(--target-definition-ref "$REF_OBJ")
[ -z "$REF_POB" ] || APROBACION+=(--population-definition-ref "$REF_POB")

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

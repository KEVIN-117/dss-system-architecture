# Dataset histórico sintético OLTP para pruebas DW

Este perfil carga únicamente el servicio PostgreSQL `postgres` de `dss-uatf/database/neo4j-db.yml`. No inicia ni modifica Neo4j, no se conecta a producción y no reutiliza filas personales de los CSV/Excel de referencia. Debe ejecutarse solo en una instancia local/descartable de Jachasun.

## Alcance y tamaño

- Rango solicitado: gestiones académicas 2000–2025 inclusive.
- Catálogo: 13 facultades y 85 códigos de carrera no ambiguos extraídos de `carreras.xlsx`; incluye carreras semestralizadas (`S`) y anualizadas (`A`), niveles LIC/TUS/TUM, estados de oferta y duraciones disponibles. Como el Excel codifica facultades A–M y OLTP espera `smallint`/`integer`, el fixture usa IDs sintéticos reservados 30001–30013; no los presenta como IDs oficiales.
- El Excel codifica vigencia como `A`/`B`; al sembrar `academico.alm_programas.activo`, el fixture normaliza esos valores a `S`/`N` para respetar el dominio activo admitido por DW-001. El catálogo auxiliar `public.fac_programas` conserva los códigos originales del Excel.
- Se generan 6.000 identidades sintéticas (`id_ra` `TEST000001`–`TEST006000`), postulaciones de primera vez y una segunda postulación para aproximadamente una de cada siete personas, cerca de 4.000 alumnos admitidos matriculados y del orden de 100.000–140.000 filas de notas/cursado. Los conteos exactos dependen de la mezcla de carreras y sus duraciones.
- Se generan materias sintéticas por programa y ciclo para soportar las FK de `notas_planilla`; las calificaciones quedan dentro de 0–100. Las notas ausentes permanecen `NULL`.
- No se generan egresos ni graduados: `fact_graduation` sigue fuera del MVP y los Excel de graduación no son una fuente OLTP aprobada.

## Archivos

- `career_catalog.csv`: catálogo institucional no personal depurado, con procedencia desde las hojas `Facultades` y `fac_carreras` del Excel.
- `source-audit.md`: inventario y análisis agregado de todos los Excel/CSV encontrados, discrepancias y decisiones de exclusión.
- `seed_historical.sql`: carga set-based dentro de una transacción. Verifica la base, rechaza tablas objetivo no vacías, usa IDs sintéticos reservados, no trunca tablas y hace rollback ante cualquier error.
- `apply_historical_schedule_catalog.sql`: inserta una sola vez `public.fac_programas` si una primera carga previa no lo incluyó; el seed actual ya incorpora el calendario `tipo_c`.
- `validate_historical.sql`: aserciones de integridad, cobertura temporal, privacidad, mezcla de calendarios y casos funcionales.
- `expected/historical-cases.yml`: casos específicos para validar extracción y transformaciones.

## Preparación y ejecución (PowerShell)

Desde la raíz de `dss-system-architecture`, con Docker Desktop iniciado:

```powershell
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$compose = "C:\Users\krodr\profile\private\dss-uatf\database\neo4j-db.yml"

# Arranca exclusivamente PostgreSQL; no ejecutar `up -d` sin nombre de servicio.
& $docker compose -f $compose up -d postgres

# Carga en una sola transacción. PGPASSWORD se obtiene del entorno del contenedor;
# no se imprime ni se pasa como argumento.
Get-Content -Raw infra/dw-test-data/historical/seed_historical.sql |
  & $docker compose -f $compose exec -T postgres sh -c 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -'

Get-Content -Raw infra/dw-test-data/historical/validate_historical.sql |
  & $docker compose -f $compose exec -T postgres sh -c 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -'
```

Si la base ya se sembró con la primera revisión del fixture (la instancia de desarrollo actual), ejecutar una vez `apply_historical_partial_cases.sql`, `apply_historical_schedule_catalog.sql` y `normalize_historical_program_flags.sql` antes de validar. El último script solo acepta `jachasun` con exactamente el catálogo sintético de 85 programas y no toca filas fuera de ese conjunto. En una base nueva el seed ya normaliza los flags; el script es innecesario y debe quedar sin ejecutar.

El script exige `current_database() = 'jachasun'` y que sus tablas de origen estén vacías. Si encuentra cualquier fila preexistente, aborta sin escribir. No se reejecuta sobre una base ya sembrada; para repetir la prueba, usar una instancia de prueba nueva o restaurada expresamente. No usar `down --volumes`, `TRUNCATE`, `DROP` ni `seed.py` sobre una base con datos que deban conservarse.

Tras cargar, inspeccionar el resumen de `validate_historical.sql` y ejecutar Apache Hop en modo histórico por gestiones/cortes. Para probar hechos por cierre, primero se debe preparar y autorizar el calendario correspondiente en la base DW separada: este seed OLTP no crea cierres ni publica datos DW.

## Seguridad y semántica

- Ningún nombre, documento, teléfono, correo, dirección o fecha de nacimiento real se copia. Todos los `id_ra` comienzan con `TEST`; datos personales de `uatf_datos` permanecen nulos.
- Los códigos `A`/`P` de `postulantes.estado` siguen la descripción disponible en el DDL del proyecto (aprobado/reprobado); `notas_planilla.estado` se conserva como valor de fixture sin certificar su dominio productivo.
- En un conjunto pequeño, `observacion` identifica notas sin calificación final y con cero o un parcial rendido. Esto prueba la definición funcional compartida por DSA (abandono: deja de asistir y rinde menos de dos parciales); no autoriza a inferir asistencia de cero como nulo ni reemplaza la aprobación del algoritmo ETL.
- Los programas con duración ausente conservan duración `NULL` en el catálogo OLTP; para crear materias sintéticas solamente se usa una malla de prueba de tres años, expresamente no institucional.
- La normalización `A→S`, `B→N` se limita al dataset sintético de prueba. No es una regla para corregir o reinterpretar códigos productivos sin aprobación de DSA/TI.
- La colisión de código `TST` entre dos programas diferentes se excluye completa y explícitamente; no se elige una carrera de forma arbitraria.
- La secuencia referenciada por el default de `notas_planilla.id_matricula` está ausente en la instancia local; el fixture usa claves explícitas reservadas y deja documentado el defecto, sin tocar el DDL ni crear secuencias.
- `public.fac_programas.tipo_c` se siembra como catálogo auxiliar anual/semestral porque `academico.alm_programas` no expone esa característica. `public.fac_programas` no pertenece a los nueve contratos DW-001 y Hop no debe consumirlo hasta aprobar su contrato.

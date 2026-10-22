# Fixture histórico sintético Jachasun v2

Este paquete sirve para una demostración local del flujo OLTP → Apache Hop → DW. El seed es determinista, enteramente ficticio y no contiene atributos personales. No es una copia ni una réplica estadística de producción.

## Separación de bases

- **OLTP de prueba:** el servicio aislado de `compose.yml`, base `jachasun_test`, puerto local `55432`, con volumen temporal. El rol de Hop es `dw_fixture_reader` y solo tiene `CONNECT`, `USAGE` y `SELECT`.
- **OLTP persistente existente:** `C:\Users\krodr\profile\private\dss-uatf\database\neo4j-db.yml` define la base `jachasun` y usa `postgres_data`. No se debe cargar este seed allí: contiene datos persistentes, el seed rechaza ese nombre y no está diseñado para ampliar una instancia ya poblada.
- **DW de desarrollo:** permanece en el Compose principal del repositorio, servicio `postgres-dw`. El seed OLTP nunca escribe en `dw` ni en `etl_control`.

El seed tiene 6.000 identidades `TEST`, carreras/facultades sintéticas, postulaciones, alumnos, materias, notas, programaciones y asignaciones. Los intentos de cursado cubren todas las gestiones 2000–2025. En la ruta exitosa se usan periodos positivos `1` y `2` (anual: `1`; semestral: `1` y `2`), compatibles con `DIM_PERIODO_ACADEMICO`. El catálogo OLTP puede contener códigos auxiliares 0–7 para probar validaciones, pero el seed no genera hechos con `id_periodo = 0`.

Los casos de abandono se identifican por parciales sintéticos ausentes (`NULL`) o no rendidos (`0`); los parciales rendidos tienen valores 1–100. Esto evita que un parcial rendido con nota cero se confunda con uno ausente. El seed conserva estados `A`/`P` y añade valores no mapeados únicamente como casos de calidad; no afirma su significado de negocio.

Las fechas generadas en OLTP son timestamps sintéticos de registro, no calendario oficial. No hay egresos ni graduaciones. La tabla `etl_control.academic_period_closure` se prepara aparte, con fechas efectivas ficticias que solo establecen un orden de prueba.

## Preparar y cargar OLTP sintético

Desde PowerShell, en la raíz de `dss-system-architecture`, con Docker Desktop iniciado:

```powershell
$f = "infra/dw-test-data/historical-v2/compose.yml"
docker compose -f $f up -d jachasun-test
docker compose -f $f ps

Get-Content -Raw "infra/dw-test-data/historical-v2/seed_v2.sql" |
  docker compose -f $f exec -T jachasun-test psql -X -U source_test -d jachasun_test -v ON_ERROR_STOP=1 -f -

Get-Content -Raw "infra/dw-test-data/historical-v2/validate_v2.sql" |
  docker compose -f $f exec -T jachasun-test psql -X -U source_test -d jachasun_test -v ON_ERROR_STOP=1 -f -
```

El contenedor fuente usa `tmpfs`: al eliminarlo se pierde esta instancia de prueba. El seed valida `current_database() = 'jachasun_test'`, rechaza tablas destino no vacías y corre en una transacción. No ejecutar `down --volumes` sobre otro Compose ni cambiar el nombre de la base para intentar eludir estas guardas.

Para que Hop Web, en el Compose principal, alcance esta fuente aislada en Docker Desktop, configura el perfil de desarrollo OLTP con:

```text
OLTP_DB_HOSTNAME=host.docker.internal
OLTP_DB_PORT=55432
OLTP_DB_DATABASE=jachasun_test
OLTP_DB_USERNAME=dw_fixture_reader
OLTP_DB_PASSWORD=fixture_readonly
OLTP_DB_URL=jdbc:postgresql://host.docker.internal:55432/jachasun_test
```

Mantén las credenciales del DW en sus variables propias; no intercambies los usuarios de origen y destino.

## Cierres ficticios en el DW

Después de aplicar las migraciones DW, se puede cargar el seed de cierres históricos basado en los 93 pares distintos válidos de `jachasun_academico_dct_asignaciones.csv` (gestiones 2000–2022). Incluye todos los códigos positivos observados, también los atípicos; no deduce etiquetas de semestre ni periodicidad:

```powershell
Get-Content -Raw "infra/dw-test-data/historical-v2/seed_dw_test_closures.sql" |
  docker compose exec -T postgres-dw sh -c 'PGOPTIONS="-c dw_test.allow_synthetic_closures=on" psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -'
```

El script crea únicamente cortes faltantes, registra el evento inicial y los cierra mediante `etl_control.transition_academic_period_closure`; no modifica filas existentes. Por seguridad exige el GUC explícito y rechaza las bases OLTP. Para este seed de prueba se asume que esos periodos históricos ya cerraron; `effective_at` se aproxima uniformemente al 15 de diciembre de cada gestión en `America/La_Paz`. Esa fecha es una **estimación de prueba**, no un registro oficial ni una fecha académica de inicio/fin. El actor `test:dct-asignaciones-historical-seed` también identifica que el registro es de prueba. **No ejecutar en producción.** Los cortes se quedan `CERRADO`; solo el flujo ETL puede marcarlos `PROCESADO` tras una publicación exitosa.

Para probar retención con evidencia de continuidad, procesa primero los cierres posteriores necesarios y vuelve a ejecutar el cierre anterior cuando corresponda; sin un cierre siguiente `PROCESADO`, la clasificación esperada es `NO_EVALUABLE`.

## Resultado de validación local

El seed se cargó y validó en Docker: 6.000 identidades, 4.154 alumnos, 6.857 postulaciones, 107.971 filas de cursado, cobertura en las 26 gestiones 2000–2025, periodos 1–2, cero referencias huérfanas y cero atributos personales poblados. El rol `dw_fixture_reader` puede consultar las tablas fuente y no tiene permiso `INSERT`.

En la base local `dss_dw`, el seed histórico crea 93 cierres `CERRADO` y 186 eventos de auditoría cuando se aplica sobre una base limpia. `dw.dim_periodo_academico` aún tiene **cero miembros estándar** tras aplicar solo las migraciones: los cierres no cargan la dimensión por sí mismos; hay que ejecutar el workflow ETL para poblarla. El CSV disponible llega hasta 2022, por lo que no aporta cierres 2023–2025.

Los conteos se registran en [`manifest.yml`](manifest.yml). El flujo completo de Hop con este volumen todavía debe ejecutarse y verificarse en la interfaz antes de considerar validada la demostración extremo a extremo.

## Límites

- El paquete se derivó de la revisión sintética v2 y del DDL local; no certifica tipos, distribución, periodos oficiales ni reglas de Jachasun productivo.
- Los 93 pares de prueba proceden del CSV extraído de `dct_asignaciones`, pero su estado cerrado y fecha del 15 de diciembre siguen siendo supuestos de prueba; no equivalen a fechas o autorizaciones oficiales verificadas.
- Los datos son sintéticos y no certifican la cardinalidad, semántica ni distribución de Jachasun productivo.
- `seed_v2.sql` es one-shot para una base limpia. Para repetir, crear otra instancia aislada; no borrar ni truncar el volumen persistente de desarrollo.

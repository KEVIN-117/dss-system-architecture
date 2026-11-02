# Contrato de evento de compra de matrícula

## Propósito y grano

El evento de compra se identifica por `public.cajas_transacciones.id_transaccion`. El contrato devuelve una fila por transacción activa tipo `7` hasta el corte académico solicitado. Las matrículas académicas son evidencia asociada al evento y no definen su grano.

Una compra semestral hecha en el período 1 puede crear matrículas para los períodos 1 y 2. Ambas filas se asocian al mismo `purchase_event_id`; la compra se cuenta una sola vez. El período de cobertura no se infiere del número de filas: se determina con el tipo histórico del programa y las reglas académicas aplicables.

## Fuentes y relación

| Fuente | Identificador y campos usados | Función |
|---|---|---|
| `public.cajas_transacciones` | `id_transaccion`, `id_alumno`, `id_gestion`, `id_periodo`, `id_tipo_transaccion`, `estado`, `id_cargo`, `costo`, `fec_transaccion`, `fec_pago` | Evento de compra candidato. Se filtra tipo `7`, estado `A` y corte solicitado. |
| `public.valores_transacciones` | `id_caja_tran`, `id_alumno`, `id_gestion`, `id_periodo`, `id_tipo_transaccion`, `estado`, `id_programa`, `costo` | Detalle opcional; la FK efectiva es `id_caja_tran = id_transaccion`. Alumno, gestión y período se verifican también. |
| `public.matriculas` | `id_matricula`, `id_alumno`, `id_gestion`, `id_periodo`, `clave`, `estado`, `_registrado` | Filas académicas creadas por el evento. Se asocian con alumno y gestión, y coincidencia exacta `_registrado = fec_pago`. |

`fec_transaccion` y `valores_transacciones.fecha` son `date`; no tienen precisión horaria suficiente para desambiguar operaciones del mismo día. Se utiliza `cajas_transacciones.fec_pago` y `matriculas._registrado`, ambos timestamp sin zona horaria. En las funciones de venta revisadas, `fec_pago` y `_registrado` reciben el `now()` predeterminado dentro de la misma transacción PostgreSQL, por lo que la coincidencia exacta de marcas de tiempo es esperada. La fecha por sí sola no se considera prueba de asociación.

La ruta `cajas.guardar_matricula_regularizacion` no escribe detalle en `valores_transacciones`; por ello, el detalle nunca es requisito para reconocer el evento. La asociación con la matrícula todavía requiere alumno, gestión y marca de tiempo exacta.

## Estado de reconciliación

La consulta `pipelines/source/sql/select_matricula_purchase_events.sql` conserva eventos sin detalle y expone `reconciliation_status`:

- `COINCIDENCIA_POR_TRANSACCION_Y_TIMESTAMP`: existe detalle de valores y matrícula asociada por la regla exacta.
- `MATRICULA_SIN_DETALLE`: existe matrícula asociada, pero no hay detalle; esperado en regularización y sujeto a revisión de otros caminos.
- `SIN_COINCIDENCIA_EXACTA`: no se encontró matrícula activa con coincidencia exacta; no se fuerza una unión por alumno/gestión solamente.

El conteo de filas de matrícula y los períodos encontrados se exponen como atributos del evento. No se convierten en eventos distintos. Una coincidencia cero o anómala debe quedar en reconciliación y no se debe adivinar una asociación temporal.

## Límites

- La consulta identifica transacciones activas tipo `7`; anulaciones que borran físicamente matrícula, transacción y detalle no son reconstruibles desde el estado OLTP actual sin una fuente histórica/auditada.
- Los campos existentes no prueban por sí solos la modalidad histórica del programa. Antes de derivar `periodos_cubiertos`, se debe resolver el programa vigente al momento del evento; el programa actual del alumno no es sustituto seguro de ese historial.
- `id_matricula` en `cajas_transacciones` puede existir en el esquema, pero las funciones revisadas no lo asignan de manera uniforme; no se usa como relación universal.
- Esta evidencia es independiente del clasificador existente de `dw.fact_retencion_desercion`. No cambia la regla de menos de dos parciales y ausencia de cursado en el siguiente cierre procesado.
- La consulta es un contrato de extracción de solo lectura. Su persistencia como hecho del DW y su inclusión en la publicación atómica requieren migración y pipeline de carga separados; no se afirma que el flujo de publicación actual ya la consuma.

## Archivos de evidencia

- DataGrip: `cajas/f_venta_matricula.sql`, `cajas/f_registrar_matricula.sql` y `cajas/guardar_matricula_regularizacion.sql`.
- DDL versionado: `infra/postgres-tx/ddl/ddl_jachasun.sql`.
- Consulta contractual: `etl-layer/apache-hop/projects/dss-uatf-etl/pipelines/source/sql/select_matricula_purchase_events.sql`.

# DW-007 — Política SCD para persona y estudiante

## Propósito y alcance

Este documento registra la política SCD2 aplicada a la historia de persona/estudiante en el Data Warehouse. Complementa el modelo lógico de DW-005 y las dimensiones físicas de DW-006. La preparación SCD2 se apoya en las migraciones `0008` y `0014` y en el flujo Apache Hop de la fase 6.4; el comportamiento pasó las pruebas de integración sintéticas. La issue #133 está cerrada; estas pruebas no se presentan como una carga productiva contra Jachasun.

La prioridad es preservar la interpretación histórica de los hechos: una fila publicada debe poder resolverse contra la versión de estudiante vigente para el cierre académico correspondiente. En el MVP, SCD2 aplica a `dw.dim_estudiante`; programa, materia, periodo y admisión se cargan conforme a sus contratos y al comportamiento implementado, sin atribuirles historización SCD2 no aprobada.

## Principios normativos

- Jachasun se consulta exclusivamente mediante los contratos aprobados en DW-001.
- La carga normativa es un snapshot completo por cierre académico. Los timestamps de origen sirven como evidencia, no como watermark obligatorio.
- Cada observación queda vinculada a un `run_id` de DW-004 y, cuando existe, al cierre DSA que determina su fecha efectiva.
- Una ejecución fallida, parcial o sin manifiestos completos no puede publicar una nueva versión.
- La historia publicada es inmutable en sentido lógico: una corrección se expresa cerrando una versión y creando otra, nunca sobrescribiendo silenciosamente el pasado.
- Los miembros `UNKNOWN (-1)` y `NOT_APPLICABLE (0)` de DW-006 son técnicos y no participan en la historización de estudiantes reales.
- La política no inventa estados, fechas ni identidad cuando la fuente no los entrega; los casos ambiguos se conservan como excepciones de calidad.

## Identidad y claves naturales

### Identidad canónica

`id_ra` es la identidad canónica de persona cuando está presente y validada. `id_alumno` es el identificador académico alterno para una observación de estudiante. Para comparar snapshots se utiliza una clave lógica de resolución:

| Situación | Clave lógica propuesta | Acción |
| --- | --- | --- |
| `id_ra` presente | `RA:<id_ra>` | Usar como identidad principal. |
| `id_ra` nulo e `id_alumno` presente | `ALUMNO:<id_alumno>` | Crear una identidad académica provisional, sin afirmar equivalencia personal. |
| Ambos presentes | `RA:<id_ra>` y asociación verificable con `id_alumno` | Conservar ambos identificadores y auditar la asociación. |
| Ambos nulos | Ninguna | No crear estudiante estándar; enrutar a `UNKNOWN` y registrar excepción. |
| Un `id_alumno` asociado a varios `id_ra` | Ambigua | El pipeline bloquea la identidad conflictiva; DSA debe resolver el caso de datos antes de su reproceso. |

La aparición posterior de un `id_ra` para una fila que antes solo tenía `id_alumno` no debe crear automáticamente una segunda persona ni cambiar retrospectivamente la clave natural. Una reconciliación aprobada debe registrar la evidencia, el `run_id`, el actor y el alcance temporal del cambio. La implementación de un catálogo de identidades o de una tabla puente queda fuera de DW-007 y deberá ser definida antes de resolver fusiones.

La surrogate key (`estudiante_sk`) identifica una versión física del DW, no reemplaza la identidad natural ni debe reutilizarse entre personas. Los miembros técnicos no tienen clave natural.

## Clasificación de atributos

La siguiente matriz es la política aplicada por el MVP a los atributos versionados. Los atributos técnicos (`created_at`, `updated_at`, `source_run_id`) no son atributos de negocio y nunca participan del hash SCD2.

| Atributo de `dim_estudiante` | Clasificación | Regla de cambio |
| --- | --- | --- |
| `id_ra` | SCD0 / identidad | No se sustituye por otro valor dentro de la misma identidad sin reconciliación aprobada. |
| `id_alumno` | SCD0 / identidad alterna | Se conserva como evidencia académica; una reasignación requiere revisión. |
| `id_sexo` | SCD2 | Un cambio observado genera nueva versión efectiva desde el corte autorizado. |
| `estado_civil` | SCD2 | Se conserva la evolución observada; `NULL` no se convierte en una categoría inventada. |
| `nac_pais` | SCD2 | Cambio historizable, sujeto a validación de catálogo. |
| `id_colegio`, `colegio` | SCD2 | Se conserva procedencia y descripción del estado observado. |
| `tipo_colegio`, `turno_colegio`, `area_colegio` | SCD2 | El cambio describe otra condición de procedencia. |
| `cod_localidad`, `localidad` | SCD2 | Se historiza la localidad observada; no se reemplaza por una localidad inferida. |
| `cod_pais`, `cod_departamento`, `cod_provincia` | SCD2 | Cambio historizable; debe respetar las validaciones de catálogo disponibles. |
| `gestion_egreso_colegio` | SCD2 | Se conserva el valor del snapshot y sus correcciones aprobadas. |
| `fec_inscripcion` | SCD2 | Se historiza solo cuando la fuente confirma una modificación válida. |
| `fec_egreso` | SCD2 | Un valor posterior o una corrección de egreso crea evidencia histórica; no se interpreta como egreso si la fuente no lo confirma. |
| `estado_academico` | SCD2 | El cambio de estado debe conservar la fecha efectiva del snapshot. |
| `tipo_alumno` | SCD2 | Se historiza porque puede modificar la interpretación académica del estudiante. |
| `technical_label` | SCD0 técnico | Solo aplica a miembros técnicos; no se usa para estudiantes estándar. |
| `member_type` | SCD0 técnico | No cambia en una fila estándar; los miembros técnicos son inmutables. |

Esta clasificación evita tratar como SCD1 los cambios que alteran la interpretación de un hecho histórico. Las correcciones puramente técnicas o de formato deberán resolverse antes de publicar; si modifican un atributo SCD2, siguen las reglas de nueva versión.

## Detección mediante hash

La detección utiliza un hash de atributos SCD2, denominado `attribute_hash_scd2`, que se incorpora físicamente en `0008_add_student_scd2_versions.sql`. La migración exige el hash en nuevas filas estándar y permite temporalmente nulos heredados con una restricción `NOT VALID`. Hop debe calcularlo y guardarlo; la migración no calcula hashes de atributos ni ejecuta cargas.

### Serialización canónica

Antes de calcular SHA-256, cada campo debe normalizarse de forma determinista:

1. Mantener el orden de columnas definido en la matriz SCD2.
2. Representar `NULL` con el token explícito `<NULL>`.
3. Recortar espacios externos solo cuando el contrato fuente lo permita; no eliminar espacios internos.
4. Usar representación decimal y de fechas estable, con fechas ISO `YYYY-MM-DD`.
5. No convertir un valor vacío en `NULL` sin registrar una regla de calidad explícita.
6. Serializar en UTF-8 con longitud en bytes (`nombre=longitud:valor`), usando longitud `-1` para `NULL`; así se evita ambigüedad por separadores o valores vacíos.
7. Aplicar SHA-256 y almacenar el resultado hexadecimal en minúsculas.

El hash no incluye surrogate keys, timestamps de procesamiento, `run_id`, estado del manifiesto ni campos derivados. Cambiar únicamente `source_run_id` no crea una versión de negocio. Un cambio SCD1 tampoco altera el hash SCD2.

Si se requiere distinguir una corrección de fuente con los mismos atributos SCD2, se conservarán el `run_id`, el manifiesto y la evidencia de corrección; no se crearán versiones artificiales idénticas solo para aumentar el conteo.

## Vigencias y versiones

La implementación usa un intervalo semiabierto:

```text
[valid_from, valid_to)
```

- La versión actual tiene `valid_to = NULL` y los índices SCD2 permiten una sola versión actual por `id_ra` y por `id_alumno`; un trigger serializa las escrituras y rechaza intervalos solapados por cualquiera de los identificadores.
- `valid_from` representa la fecha/hora efectiva del cierre que observó el cambio, no el momento en que el ETL terminó.
- `observed_at` o el timestamp de procesamiento se conserva como metadato de auditoría separado.
- Al detectar un cambio SCD2, la versión anterior se cierra en el mismo instante efectivo que inicia la nueva versión.
- No se permiten intervalos solapados ni `valid_to <= valid_from`.
- El orden de periodos no se infiere mediante `periodo + 1`; se usa la secuencia de cierres DSA de DW-002.

Para snapshots repetidos con el mismo `valid_from`, se conserva el orden de procesamiento y `run_id`. Si dos ejecuciones contienen valores distintos para la misma identidad y fecha efectiva, el caso se bloquea como conflicto para que DSA resuelva la observación antes de reprocesar; no se elige un valor automáticamente.

## Reglas de carga conceptual

El flujo deberá seguir esta secuencia:

```mermaid
flowchart LR
    Snapshot[Snapshot completo de Jachasun] --> Identity[Resolver identidad]
    Identity --> Quality[Validar nulos duplicados y conflictos]
    Quality --> Hash[Calcular hash SCD2]
    Hash --> Compare{¿Existe versión vigente?}
    Compare -->|No| Initial[Crear versión inicial]
    Compare -->|Sí, mismo hash| SCD1[Actualizar solo atributos SCD1]
    Compare -->|Sí, hash distinto| Close[Cerrar versión vigente]
    Close --> NewVersion[Crear nueva versión SCD2]
    Initial --> Audit[Registrar run_id y manifiesto]
    SCD1 --> Audit
    NewVersion --> Audit
    Quality -->|Conflicto| Quarantine[No publicar y registrar error bloqueante]
```

### Interpretación del diagrama

El snapshot representa una observación completa, no una orden de sobrescritura. Primero se resuelve la identidad y se validan duplicados, claves nulas y conflictos. Solo después se calcula el hash de atributos historizables.

Si la identidad no existe, se crea su primera versión. Si existe y el hash SCD2 no cambió, no se multiplica la historia; como máximo se actualizan atributos SCD1 y la evidencia técnica. Si el hash cambió, se cierra la versión vigente y se crea otra con una fecha efectiva coherente con el cierre DSA. Un conflicto de identidad o de fecha no puede continuar hacia publicación: debe quedar en la auditoría de errores del `run_id`.

## Implementación Hop — Req. 6.4

El pipeline `pl_dim_estudiante_scd2_mvp.hpl` obtiene el snapshot de `academico.alumnos` y lo enriquece con los campos aprobados de `public.uatf_datos`, colegios y localidades. La ejecución debe corresponder a un cierre académico elegible; `effective_at` del cierre determina `valid_from`, no el reloj del contenedor.

La rutina `etl_control.prepare_hop_student_scd2(run_id, student_json)` valida la ejecución y el cierre, resuelve la clave `RA:<id_ra>` o provisional `ALUMNO:<id_alumno>`, serializa los atributos SCD2 de forma canónica y compara el hash con la versión vigente. La rutina no publica directamente: solo registra operaciones `INSERT` o `CLOSE` mediante `stage_hop_publication_row`, para que el publisher las aplique atómicamente con el resto de la carga.

- Primera observación: prepara un `INSERT` de versión estándar.
- Hash sin cambios: no prepara una nueva versión.
- Cambio de atributos: prepara el cierre de la versión vigente y el `INSERT` de la nueva versión con el mismo corte efectivo.
- Identidad ambigua, discrepancia entre RA y alumno, perfil demográfico faltante para un RA o corte fuera de orden: bloquea la preparación.
- La ausencia de un estudiante en una extracción no cierra su versión; la expiración por ausencia requiere una política explícita posterior.

Las pruebas de integración verifican las operaciones preparadas y la publicación transaccional de cambios sobre fixtures, incluyendo rollback de los datos de prueba. El workflow vertical del MVP también ejecuta el publisher atómico. Para una futura ejecución productiva se mantienen las autorizaciones de corte, los permisos runtime y los controles de cambio propios del ambiente.

## Correcciones tardías y duplicados

### Clasificación de observaciones tardías

| Caso | Tratamiento |
| --- | --- |
| Observación recibida después del cierre, con fecha efectiva posterior | Crear versión futura cuando el cierre esté autorizado. |
| Reejecución del mismo snapshot y mismo hash | No crear nueva versión; registrar ejecución repetida. |
| Mismo cierre, mismo estudiante, atributos diferentes | Bloquear como conflicto; no elegir arbitrariamente. |
| Corrección con fecha efectiva igual a la versión vigente | Reemplazar mediante versión de corrección auditable o conservar una única versión, según decisión DSA. Nunca sobrescribir sin evidencia. |
| Corrección con fecha efectiva anterior a versiones publicadas | Reabrir el cálculo temporal afectado mediante reproceso autorizado; conservar ambos `run_id` y el motivo. |
| Duplicados idénticos dentro de un snapshot | Colapsar para publicación y registrar el conteo de duplicados. |
| Duplicados conflictivos dentro de un snapshot | Rechazar la identidad afectada y generar error bloqueante. |

Una corrección tardía no reemplaza automáticamente hechos ya publicados. Debe generar un reproceso posterior que determine qué hechos requieren actualización. La coordinación de ese reproceso pertenece a las issues de ejecución y carga posteriores, no a esta política.

## Nulos, desconocidos y datos personales

- `NULL` representa ausencia desconocida o no informada, según el contrato fuente; no se convierte automáticamente en cero, cadena vacía o categoría funcional.
- `UNKNOWN` se utiliza cuando el hecho necesita una relación de estudiante, pero la identidad no pudo resolverse de forma confiable.
- `NOT_APPLICABLE` se utiliza cuando la relación no corresponde al proceso analítico.
- Los miembros técnicos no adquieren vigencia SCD2 ni se transforman en filas estándar por actualización directa.
- Nombres, documentos, teléfonos, direcciones, correos y fechas de nacimiento permanecen fuera del alcance autorizado de DW-001.
- Los detalles de error y manifiestos no deben almacenar valores personales ni contenido de archivos; solo referencias técnicas saneadas.

## Linaje, seguridad y responsabilidades

| Responsabilidad | DSA | TI/DBA | ETL futuro |
| --- | --- | --- | --- |
| Aprobar atributos SCD0/SCD1/SCD2 | Responsable | Revisa impacto técnico | Implementa sin reinterpretar |
| Aprobar equivalencia de identidades | Responsable | Audita evidencia | Bloquea casos ambiguos |
| Autorizar cierre o reapertura | Responsable | Ejecuta controles | Consume calendario DW-002 |
| Aplicar cambios de dimensión | Valida resultado | Administra permisos | Ejecuta con `run_id` y manifiesto |
| Resolver errores críticos | Decide funcionalmente | Conserva auditoría | Reintenta o solicita reproceso |

La cuenta de extracción sigue siendo de solo lectura. El publicador futuro debe operar mediante los privilegios de `dw_publisher` definidos en DW-006 y no debe modificar miembros técnicos ni eliminar versiones históricas.

## Casos de aceptación

| Caso | Resultado esperado |
| --- | --- |
| Primera observación de un estudiante válido | Una versión estándar con `valid_from`, hash SCD2 y `run_id`. |
| Cambio de `estado_academico` | Cierre de la versión anterior y creación de una nueva. |
| Cambio de un atributo SCD1 | No aumenta el número de versiones SCD2. |
| Snapshot repetido | No genera duplicados ni intervalos solapados. |
| `id_ra` nulo con `id_alumno` válido | Identidad académica provisional, trazable y no fusionada automáticamente. |
| Duplicado conflictivo | Error bloqueante; la ejecución no publica información parcial. |
| Corrección retroactiva | Reproceso autorizado, con evidencia y preservación de los `run_id`. |
| Miembro `UNKNOWN` o `NOT_APPLICABLE` | Permanece técnico y no es actualizado como estudiante real. |
| Ejecución sin manifiesto completo | No crea ni publica nuevas versiones. |

## Estado de implementación y baseline

La política SCD2, el hash canónico, la preparación de transiciones desde Hop y la publicación atómica se implementaron como parte de la issue #133 y se probaron con fixtures. Las pruebas cubren atributos, vigencias semiabiertas, replays, cambios, identidades conflictivas, orden temporal y rollback.

Las filas estándar preexistentes reciben `created_at` como baseline técnico con hash nulo; esa fecha no se interpreta como vigencia histórica OLTP. En un nuevo ambiente productivo, el primer baseline debe definirse de acuerdo con el corte autorizado y sus datos disponibles antes de publicar hechos históricos. Esto es una condición de carga inicial del ambiente, no una tarea de implementación pendiente del MVP.

## Límites y dependencias

- DW-001 define los campos y filtros autorizados de Jachasun.
- DW-002 define los cierres y su autorización funcional.
- DW-004 aporta `run_id`, eventos, manifiestos, métricas y errores.
- DW-005 define la constelación y el grano de los hechos.
- DW-006 aporta las dimensiones físicas y los miembros técnicos.
- Para el MVP de #133, la carga directa desde Jachasun con Apache Hop respeta esta política, sin exigir RAW ni Load Manager. `0008` materializa vigencias e identidad temporal; `0014` prepara cambios SCD2; el workflow calcula el hash, usa `effective_at` del cierre y deja al publisher resolver/aplicar las operaciones en forma atómica.
- DW-007 no implementa extracción, transformación Apache Hop, Go, cron, API, hechos ni modelos ML.

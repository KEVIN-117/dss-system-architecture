# PRED-006 — Implementación de inferencia puntual

## Alcance implementado

El alcance aceptado de PRED-006 es la inferencia individual de **abandono del programa**. `POST /v1/predictions` resuelve estudiante, programa y corte desde el DW; no acepta variables predictoras del cliente. La ruta técnica de abandono de materia se conserva como experimental y no forma parte de la capacidad aceptada ni debe usarse para predicción prospectiva:

- `program_dropout`: estudiante–programa–corte, etiqueta `DESERTOR` frente a `RETENIDO` para el cierre siguiente esperado por cadencia.

Abandono de materia queda diferido a un alcance posterior. Aunque hay una ruta experimental para `course_abandonment`, `fact_cursado.es_abandono` confirma dos parciales ausentes después del cierre y no demuestra que el riesgo pueda predecirse antes de la segunda inasistencia.

Cada bundle declara objetivo, grano y cadencia (`ANUAL` o `SEMESTRAL`). El registry guarda punteros independientes por evento y cadencia, de modo que los modelos no se mezclan entre objetivos ni entre modalidades.

1. Valida el JWT Keycloak (firma JWKS, issuer, audience y expiración) y consulta el perfil activo en Auth Service.
2. Comprueba un rol académico configurado y que el contexto `academicContexts` cubra el programa solicitado. Rector tiene alcance institucional; decano, de facultad; director, de carrera. `SUPERADMIN` no recibe permisos académicos implícitos.
3. Resuelve un cierre procesado y la carrera activa en el DW.
4. Deriva cadencia de los períodos procesados y rechaza historiales mixtos. La población queda limitada a los primeros seis períodos semestrales o tres cierres anuales desde el primer cursado procesado del estudiante–programa.
5. Para abandono de programa consulta el hecho de retención del corte. Para abandono de materia exige `course_ref` y una matrícula/curso en el corte solicitado. Lee solamente las features declaradas en el manifiesto y nunca selecciona el campo objetivo en la ruta de scoring.
6. Obtiene una sola vez el bundle activo, transforma una fila nueva y asocia la probabilidad a la clase positiva indicada por el manifiesto y el orden real de `classes_` del estimador.

El scoring no modifica el modelo, pipeline, features ni registros DW. Sin modelo activo, conexión/identidad/política configurada, esquema compatible o evidencia suficiente, devuelve error y no genera una respuesta simulada.

## Artefactos y permisos DW

- `prediction-service/inference.py`: contrato interno, validación de features, control de ámbito y scoring sin estado mutable por solicitud.
- `prediction-service/inference_adapters.py`: adapters Keycloak/Auth Service y PostgreSQL DW.
- `prediction-service/training/model_registry.py`: activa y resuelve bundles aprobados con puntero independiente por evento/cadencia; conserva el modo legado solo para operadores.
- `infra/dw-schema/migrations/0031_prediction_inference_read_access.sql`: crea `dw_prediction_reader` y concede `SELECT` solo en las tablas requeridas. El login de inferencia debe ser distinto al login del job store (`dw_prediction_runtime`).
- `infra/dw-schema/tests/prediction_inference_read_access_test.sql`: comprueba lectura permitida y ausencia de permisos de escritura o lectura de dimensiones ajenas al flujo.
- `docs/prediction/contracts/prediction-api-v1.yaml`: endpoint y contrato de respuesta.

## Prueba E2E con DW Faker

Con el servicio DW local levantado y el entorno de desarrollo configurado, ejecutar desde `prediction-service`:

```powershell
.\tests\integration\run_prediction_faker_e2e.ps1
```

El script lee una muestra del DW en transacción read-only, crea bundles de prueba bajo un directorio temporal y llama a `POST /v1/predictions` para los dos objetivos. La inferencia de abandono de programa aporta la evidencia E2E de PRED-006; el caso de materia solo comprueba la ruta experimental diferida. Usa una identidad de integración local y evidencia sintética solo para probar la ruta técnica; no usa Keycloak/Auth Service reales, no modifica el DW ni el volumen normal de artefactos, y elimina los bundles al terminar. Un `200` confirma el recorrido técnico; no acredita desempeño del modelo ni autoriza despliegue.

Configurar `PREDICTION_DW_DATABASE_URL` con un login miembro de `dw_prediction_reader`, además de la configuración Keycloak (`KEYCLOAK_URL`/`KEYCLOAK_REALM` o `KEYCLOAK_ISSUER_URI`, audience, cliente de roles y, si es necesario, una URL JWKS interna), `AUTH_SERVICE_URL` y `PREDICTION_ALLOWED_ROLES`. La lista de roles permanece vacía por defecto para evitar habilitar acceso institucional sin decisión IAM/DSA.

## Evidencia de verificación

La suite local valida la asociación correcta de probabilidad/clase, esquema y procedencia de features, límites de ámbito académico, selección del modelo por evento/cadencia, secuencia A/B/A y solicitudes concurrentes. Los tests de API validan la autenticación requerida y serialización de ambos contratos. El smoke de Compose valida la carga de un bundle de scope desde el volumen compartido y su recarga tras reiniciar API. La migración añade una comprobación SQL de mínimo privilegio.

El alcance de software de PRED-006 se limita a inferencia de abandono del programa y cuenta con prueba E2E Faker para ese evento. La aprobación de un bundle institucional, una extracción autorizada y la validación operativa coordinada de Keycloak/Auth Service/DW son requisitos de despliegue institucional, no de esta entrega de software. La predicción prospectiva de abandono de materia queda diferida hasta que exista una fuente temporal adecuada.

Las pruebas sintéticas verifican el comportamiento técnico; no prueban efectividad predictiva ni autorizan el uso de datos institucionales. Antes de habilitar inferencia institucional deben existir un artefacto aprobado con evidencia no sintética y decisiones firmadas sobre target/horizonte, roles/audience, mapeos de identidad y disponibilidad temporal de features. Hasta entonces la configuración incompleta hace que el servicio falle cerradamente.

## Límites y asuntos pendientes

- El adaptador de estudiante usa la referencia académica numérica del DW. El identificador público/pseudónimo final debe confirmarse con DSA antes de exponer el endpoint fuera de la red interna.
- `PREDICTION_ALLOWED_ROLES` es una compuerta configurable, no una asignación institucional aprobada. No debe llenarse en despliegues hasta confirmar la matriz IAM.
- La elegibilidad temporal está alineada con códigos de período DW: 1/2 semestral y 3 anual. Se rechazan historiales con cadencia mixta; casos de cambio de programa/carrera requieren una regla de negocio confirmada.
- La respuesta `event_code` procede del manifiesto aprobado. Aún se requiere asegurar que el manifiesto/modelo promovido represente exactamente el evento y horizonte DSA aprobados.
- `fact_cursado` se publica al procesar el cierre y no conserva inscripción de curso con una fecha de disponibilidad previa al resultado. La ruta de abandono de materia está conectada técnicamente al hecho observado; para una predicción prospectiva antes del resultado, DW debe exponer una inscripción/carga académica disponible al inicio del período. No interpretar la consulta post-cierre como evidencia de un despliegue en tiempo real.
- El evento de abandono de materia se define como faltar a dos parciales. `fact_cursado.es_abandono` sirve como etiqueta observada para Faker, pero solo queda disponible tras procesar el cierre. Por eso el E2E actual puede puntuar una fila observada retrospectivamente y no demuestra que el riesgo pueda predecirse antes de la segunda inasistencia. Para esa predicción anticipada hace falta una fuente de inscripción y asistencia con disponibilidad temporal anterior al evento, junto con features congeladas al corte de inferencia.
- Esta issue implementa inferencia por solicitud. La persistencia/publicación poblacional corresponde a PRED-007; ninguna predicción se inserta en `fact_retencion_desercion`.

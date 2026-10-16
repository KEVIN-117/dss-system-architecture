# ADR-PRED-001 — Arquitectura y contratos del motor predictivo

- **Estado:** Propuesto para revisión de DSA/TI
- **Fecha:** 2026-10-14
- **Issue:** [PRED-001](https://github.com/KEVIN-117/dss-system-architecture/issues/144)
- **Alcance:** límites, integración y contratos iniciales. Las reglas de negocio marcadas como pendientes no se consideran aprobadas por este ADR.

## Contexto

El DSS ya cuenta con un DW PostgreSQL, una aplicación BFF Next.js que autentica sesiones con Keycloak y llama OLAP por proxy REST, y una aplicación FastAPI de predicción cuya ruta actual es simulada. El DW publica hechos de admisión, cursado y retención/deserción; la última conserva `RETENIDO`, `DESERTOR` y `NO_EVALUABLE`, además del periodo/cierre y linaje de carga. El rol `dw_ml_writer` puede leer `dw` y escribir en `ml_workspace`. No se encontró un contrato productivo de trabajos ML, una tabla de publicación de predicciones ni un registro de artefactos materializado.

Los impulsores de arquitectura, en orden, son: (1) validez y trazabilidad analítica; (2) privacidad y autorización institucional; (3) aislamiento del entrenamiento frente a inferencia y OLAP; (4) integración compatible con la plataforma existente; y (5) simplicidad operativa. No hay evidencia para fijar volúmenes, SLA, presupuesto de latencia o disponibilidad ni permisos productivos.

## Decisiones propuestas

### D1. Separar el proceso de entrenamiento del API de inferencia

El API FastAPI valida y ejecuta inferencias con un artefacto aprobado e inmutable. El entrenamiento y la evaluación corren como trabajos en un worker separado del proceso/API; al menos API y worker tendrán límites de CPU, memoria y concurrencia independientes. El mecanismo concreto de inicio/cola y el almacenamiento de estado se fijarán al confirmar capacidades operativas.

**Razón:** entrenamiento y búsqueda de hiperparámetros son cargas CPU intensivas y de duración variable. Ejecutarlas dentro del proceso que atiende inferencia permite que una tarea prolongada degrade o bloquee peticiones y dificulta aislar fallos. No se prescribe broker ni orquestador antes de conocer escala y operación.

**Consecuencias:** requiere contrato de trabajo asíncrono y estado consultable; introduce coordinación y necesidad de idempotencia, timeout, límites, cancelación o recuperación según soporte real. Un reinicio del worker no debe reemplazar modelo activo ni producir un artefacto parcial visible.

### D2. Usar REST servidor-a-servidor mediante el BFF vigente; no asumir GraphQL

La SPA llama al BFF Next.js. El BFF autentica la sesión, aplica el permiso de operación y reenvía el access token a la API predictiva por HTTP interno. La API predictiva valida firma, issuer, audiencia y vigencia por sí misma. Las operaciones que requieren ámbito académico resuelven el perfil activo y `academicContexts` desde el servicio de identidad/autorización vigente y verifican en servidor el programa/estudiante solicitado; nunca aceptan facultad/carrera como autorización declarada por el navegador.

**Razón:** el proxy OLAP existente ya sigue el patrón BFF → servicio REST con el bearer token. En la rama no se encontraron rutas GraphQL en `dss-monorepo/apps/bff`; Compose menciona `gateway/graphql-bff`, pero no existe esa ruta de código en el checkout. No se debe basar el diseño en un servicio ausente o un flujo GraphQL no verificado.

**Consecuencias:** el token del usuario se valida también en el servicio de dominio, y debe acordarse el audience para ML. La decisión concreta de permisos para entrenar y los permisos de consulta `analytics:career`, `analytics:faculty`, `analytics:global` se deben mapear a los ámbitos que retorne `academicContexts`. El BFF sigue siendo punto de entrada de navegador; el API debe rechazar llamadas no autenticadas aunque procedan de la red interna.

### D3. Leer datos predictivos del DW por contrato de solo lectura y snapshot versionado

El motor consumirá únicamente vistas/tablas y campos analíticos autorizados del DW; no leerá OLTP ni modificará hechos fuente. Cada dataset de entrenamiento identifica corte/cierre, grano, esquema, versión de consulta/contrato, conteos, exclusiones y hashes o referencia inmutable de snapshot. El entrenamiento registra ese identificador. El adaptador no convierte `NO_EVALUABLE` en una etiqueta negativa ni genera variables posteriores al instante predicho.

Para reproducibilidad, priorizar una extracción/snapshot identificada sobre consultar datos cambiantes durante el entrenamiento. El artefacto o snapshot se conservará en una ubicación aprobada dentro de `ml_workspace` o almacenamiento que TI valide; nombre de tabla, formato, retención y permisos quedan para la decisión de despliegue.

**Consecuencias:** se necesita un gate para datos incompletos o cortes no válidos y registrar qué corte produjo qué modelo. Snapshots grandes pueden consumir almacenamiento; se medirán antes de decidir formato/retención. No se concede acceso a datos productivos por esta decisión.

### D4. Separar artefactos de modelo de resultados publicados

Metadatos de trabajo, snapshots técnicos y artefactos de candidatos/activos pertenecen a un espacio de trabajo ML privado (el `ml_workspace` existente es la primera opción a validar). Las predicciones consumibles por OLAP/BFF/UI se publican por un contrato analítico dedicado, con versión, corte/ejecución, estado de publicación y grano explícitos. No se mezclan predicciones con `fact_retencion_desercion`: ese hecho representa el resultado observado, mientras que una predicción es una estimación emitida antes o durante un corte y lleva su propia versión de modelo.

La ubicación física, nombre de tabla/vista y rol de lectura se implementarán en PRED-007 con DW/OLAP. No se presupone que exista `ml_predictions`; si se propone una relación específica, requiere DDL, ownership, publicación atómica y autorización compatibles con el DW.

**Consecuencias:** OLAP/BFF puede consultar predicciones sin cargar al API cada consulta de dashboard; existe latencia de publicación y hay que comunicar corte/versión/estado. Una publicación incompleta debe poder detectarse y no aparecer como lote completo.

### D5. Cubrir consulta individual en línea y publicación por población como modos de consumo

El contrato admite inferencia sincrónica individual para una consulta puntual de un perfil elegible y publicación de predicciones de población por una ejecución identificada para analítica. La segunda se trata como flujo de scoring/publicación asíncrono, no como una petición HTTP larga. En ambos casos cada resultado se fija a una sola versión de modelo y contexto temporal. What-If no queda incluido en esta decisión base.

**Razón:** la ruta de inferencia de un estudiante y el dashboard institucional resuelven necesidades diferentes: respuesta puntual y consulta agregada/listados sobre una población. Compartir el artefacto y el contrato de resultado evita tener semánticas de riesgo distintas.

**Consecuencias:** el scoring poblacional debe tener estado, publicación completa y recuperación definidos con PRED-007; las necesidades de latencia y volumen deben medirse. Si DSA/consumidores confirman un solo modo, se puede simplificar antes de implementarlo.

## Alternativas consideradas

| Tema | Alternativa | Ventajas | Costes/riesgos | Decisión |
|---|---|---|---|---|
| Entrenamiento | Dentro del proceso FastAPI | Menos componentes y despliegue inicial simple. | Contención CPU/memoria, colas de peticiones y fallo acoplado. | Rechazada para entrenamiento por RNF-09; worker separado. |
| Entrenamiento | API y worker separados con broker ahora | Desacoplamiento y escalado independiente. | Broker/operación/reintentos y duplicación antes de conocer carga. | Mantener separación; broker queda sin decidir. |
| Integración UI | GraphQL como gateway ML | Puede consolidar consultas de múltiples dominios. | BFF actual no muestra GraphQL implementado; implementación legada no encontrada en checkout. | No asumir; usar patrón REST BFF existente. Reconsiderar al verificar el roadmap BFF. |
| Datos de entrenamiento | Consulta ad hoc directa durante el ajuste | Menos copia inicial. | Datos mutables, difícil reproducibilidad, contención DW y consultas largas. | Preferir snapshot identificado; forma física pendiente. |
| Datos de entrenamiento | Exportar todo desde ETL sin control del motor | Desacopla la lectura del modelo. | Puede fijar etiqueta/transformación/SMOTE fuera del ciclo de particiones y ocultar linaje. | ETL publica hechos limpios; preparación específica y balanceo dentro del pipeline ML. |
| Resultados | Escribir predicciones en `fact_retencion_desercion` | Reutiliza dimensiones y filtros actuales. | Confunde observación y estimación, mezcla granos/tiempos/versiones. | Rechazada; publicación analítica separada. |
| Resultados | Mantener predicción solo en memoria del API | No requiere persistencia. | Dashboard no puede consultar cohortes/histórico/versiones; pérdida al reiniciar. | Rechazada para publicación; mantener resultados durables en contrato DW/analítica. |
| Modos | Solo inferencia individual | Implementación corta y baja latencia por solicitud. | No satisface listado/analítica de cohorte sin llamada por estudiante. | No basta para consumo DSS. |
| Modos | Solo batch | Eficiente para tableros y cortes. | No cubre consulta individual oportuna. | No basta para RF4.2. |
| Modos | Individual sincrónico + scoring poblacional asíncrono | Alinea consumo puntual y analítico. | Requiere dos recorridos y contrato de ejecución/publicación. | Propuesta, sujeta a confirmación de consumidores. |

## Definición del problema y reglas de salida

### Propuesta analítica a validar con DSA

- Problema candidato: clasificación binaria de deserción futura, usando `DESERTOR` como evento positivo y `RETENIDO` como negativo solo cuando ambos sean evaluables según el DW. `NO_EVALUABLE` se excluye del entrenamiento y se cuantifica en el informe.
- Horizonte candidato: evento de deserción en el siguiente cierre académico DSA procesado después del corte usado como instante de predicción. Este horizonte es una inferencia útil a partir del hecho actual, pero requiere aprobación institucional antes de entrenar un modelo institucional.
- Grano candidato: estudiante-programa-corte cerrado. Evitar fuga entre versiones repetidas del mismo estudiante y separar temporalmente los periodos según el protocolo de PRED-004.
- La propuesta de perfil menciona estudiantes de primer y segundo año; la regla verificable de elegibilidad no está implementada en los contratos DW revisados y requiere aprobación/documentación.
- El DW actual contiene variables académicas de admisión, cursado y retención; no se observó un contrato analítico actual para variables socioeconómicas, becas o bloqueos administrativos. No serán supuestas como entradas del primer modelo.
- La clase del modelo es binaria. Las etiquetas de interfaz alto/medio/bajo son bandas de decisión/visualización, no clases nuevas del clasificador. Umbral y calibración requieren decisión documentada y capacidad de intervención; no se fijan valores en este ADR.

### Criterios de éxito

1. **Éxito de negocio:** DSA aprueba evento, horizonte, población y costes relativos de falsos negativos/falsos positivos; luego fija un criterio cuantitativo y una política de revisión humana. Recall de la clase positiva debe priorizarse frente a Accuracy, manteniendo precision/F1 y capacidad institucional dentro del balance acordado. Hasta entonces, cualquier métrica es descriptiva, no un gate de aprobación.
2. **Éxito predictivo:** comparación reproducible de Random Forest y XGBoost con particiones temporalmente válidas; test final no participa en ajuste, selección de variables, hiperparámetros ni umbral. Reportar matriz de confusión, recall, precision, F1, soporte, ROC-AUC y PR-AUC cuando calculables, con clase positiva y versión del dataset/modelo explícitas.
3. **Éxito de datos:** perfil de faltantes, duplicados, distribución de clase, cobertura por programa/corte y exclusiones; variables disponibles al instante de predicción, sin etiqueta ni información posterior; semilla/procedencia guardadas.
4. **Éxito operativo:** candidato no se activa automáticamente; rollback conserva versión anterior; error/caída del worker no degrada el API/OLAP; métricas de latencia, error y recursos definen línea base y límites con TI antes de prueba de carga en PRED-008.
5. **Éxito de seguridad:** solo personas/servicios autorizados pueden iniciar trabajos o consultar resultados; consultas individuales validan el ámbito académico en servidor; APIs rechazan token inválido y errores no revelan perfiles; datos estudiantiles no se imprimen ni registran completos.

## Autorización propuesta

- **Solicitar entrenamiento:** solo operador ML explícitamente autorizado por DSA/TI; el rol/permiso actual que se asignará está pendiente. No asumir que `SUPERADMIN` técnico equivale a autoridad académica: el RBAC actual lo mantiene separado de `analytics:*`.
- **Consulta académica:** preservar Keycloak como emisor y el patrón del BFF de enviar bearer token al servicio. La API verifica token/issuer/audience y perfil activo. Determina el ámbito con roles más `academicContexts` confiables: director/carrera, decano/facultad, rector/global, conforme a la política que DSA/IAM aprueben. Filtrado solo en BFF/UI no constituye autorización suficiente.
- **Scoring de población:** identidad de ejecución de servicio y autorización de operación segregadas de los permisos de consulta de usuario. El trabajo conserva solicitante, alcance autorizado, snapshot y audit trail.
- **Acceso a DB:** runtime ML usa identidad SQL de mínimo privilegio; lectura de las relaciones aprobadas del DW y escritura solo en objetos ML autorizados. No reutilizar `dw_owner`, `dw_publisher` ni credenciales OLTP.

## Decisiones aún abiertas

1. Aprobación de evento/horizonte, tratamiento de transferencias, egresos y cierres reabiertos.
2. Regla institucional y fuente para primer/segundo año; precisión de población observable.
3. Mapeo de roles/permisos para entrenar, consultar perfiles y hacer scoring; límites exactos de `academicContexts` para usuarios multi-carrera/multi-facultad.
4. Modo inicial y frecuencia de scoring poblacional; latencias aceptables para inferencia individual.
5. Mecánica y retención del snapshot, trabajo, modelo y reporte; elección entre filesystem/volumen versionado u otro backend permitido.
6. Mecanismo de orquestación de trabajo y visualización de progreso. SSE sigue siendo adicional hasta confirmar alcance; polling no se impone como requisito de UX.
7. Relación física para publicación, su ownership/grants y su contrato con OLAP/BFF.
8. Audience/token dedicado y flujo de autenticación servicio-a-servicio para tareas no iniciadas por usuario.
9. Umbrales de selección de modelo, política de bandas visuales y capacidad de intervención institucional.

## Consecuencias, riesgos y mitigaciones

- **Fuga temporal/por estudiante:** hacer snapshot por instante de decisión; definir split temporal y agrupamiento por estudiante en PRED-002/PRED-004; auditar solapamientos.
- **Etiquetas parciales:** `NO_EVALUABLE` fuera de entrenamiento/test; medir proporción excluida; volver a comprensión de datos si la cobertura no alcanza decisión válida.
- **Contención DW:** separar proceso no elimina competencia por DB/IO. Limitar jobs, CPU/memoria, conexión, consulta y medir con carga de inferencia/OLAP en PRED-008.
- **Publicación parcial o versiones mezcladas:** tratar cada lote como unidad con ID/versión/estado; lectores consultan solo lote publicado según política acordada; una solicitud fija una única versión de modelo.
- **Fallo/reintento:** claves idempotentes por job/lote/snapshot/modelo; no activar ni publicar dos veces por reintentos; fallos permanecen observables.
- **Brecha de BFF legado:** reconciliar el `graphql-bff` citado en Compose con el BFF activo antes de despliegue; no enrutar a path ausente.
- **Sesgo/uso indebido:** resultados apoyan revisión humana; revisar métricas por programa/cohorte, cobertura y cambios de distribución; no etiquetar estudiantes como decisiones irrevocables.

## Plan de evolución e implementación

| Issue | Alcance relacionado y gate |
|---|---|
| PRED-001 | Aprobar vocabulario y decisiones implementables; documentar interfaces, seguridad, alternativas y límites. |
| PRED-002 | Perfil del DW, elegibilidad, evento/horizonte, calidad, esquema versionado y viabilidad; bloquear modelado real ante carencias. |
| PRED-003 | Pipelines RF/XGBoost fuera de API; splits reproducibles; transformaciones y SMOTE solo dentro de entrenamiento/fold si corresponde. |
| PRED-004 | Evaluación independiente y decisión apto/no apto/evidencia insuficiente conforme a criterios DSA. |
| PRED-005 | Artefacto completo/versionado e integridad; promoción y rollback explícitos. |
| PRED-006 | Inferencia real por solicitud; esquema/errores, clase/probabilidad semánticas, autorización e independencia. |
| PRED-007 | Publicación analítica versionada y acceso por OLAP/BFF/UI con controles de ámbito; lote no parcial. |
| PRED-008 | Medición comparativa de entrenamiento e inferencia/consultas, límites y fallos, umbrales acordados con TI. |

El ciclo es iterativo: problema/éxito (Business Understanding) → exploración/viabilidad (Data Understanding) → snapshot/particiones/pipeline (Data Preparation) → candidatos (Modeling) → comparación final (Evaluation) → promoción/integración/monitorización (Deployment). Evidencia insuficiente en etiqueta/población retorna a comprensión del negocio/datos; fuga o calidad retorna a preparación; utilidad predictiva insuficiente retorna a negocio/preparación/modelado con causa; degradación operativa retorna a arquitectura/despliegue. Fixtures validan software, no rendimiento institucional. El modelo entra en operación únicamente con datos institucionales elegibles y decisión documentada.

## Trazabilidad con requisitos consolidados

| Requisito | Decisión/cobertura | Issue/evidencia |
|---|---|---|
| PRED RF-10: ciclo de modelado CRISP-DM | Definición y ciclo con retornos, evidencia versionada. | PRED-001, PRED-002, PRED-003, PRED-004, PRED-005. |
| PRED RF-11: predicción | Contrato individual real y perfil/contexto confiable. | PRED-001, PRED-005, PRED-006. |
| PRED RF-12: consulta/publicación | Separar predicción de hecho observado; publicación por contrato analítico y consulta OLAP/BFF. | PRED-001, PRED-007. |
| PRED RNF-08: calidad | Particiones independientes, métricas por clase, decisión de negocio y linaje. | PRED-001, PRED-002, PRED-004, PRED-005. |
| PRED RNF-09: aislamiento | Worker separado, servicio de inferencia independiente, límites y prueba bajo carga. | PRED-001, PRED-003, PRED-006, PRED-008. |
| Consolidado RF4.1 | DW + RF/XGB + CRISP-DM en el núcleo; acceso a datos por contrato de solo lectura. | PRED-002–005. |
| Consolidado RF4.2 | API REST para inferencia incluida. What-If se registra como ampliación explícita pendiente, no gate de PRED-001. | PRED-001, PRED-006; What-If pendiente de decisión de alcance. |
| Consolidado RF4.3 | SHAP no es gate del alcance base y no tiene evidencia/contrato aún; requiere issue/decisión explícita. | Fuera del cierre automático de PRED-001. |
| Consolidado RNF4.1 | Estado de jobs forma parte del contrato; SSE es tecnología adicional pendiente de validación operativa/UX. | PRED-001/PRED-003; SSE fuera del gate base. |
| Consolidado RNF4.2 | Stateless en solicitudes/inferencia; persistencia duradera de artefactos/jobs/lotes no contradice el escalamiento horizontal. | PRED-003, PRED-005–008. |
| Consolidado RF1.4 (límite con ETL) | Ingesta publica datos limpios; partición y balanceo son del pipeline ML para evitar leakage. | PRED-002/PRED-003; aclarar responsabilidad en contrato ETL/DW. |

## Inventario y evidencias de arquitectura

| Elemento | Evidencia de la rama | Estado |
|---|---|---|
| API de predicción | `prediction-service/main.py`, `pyproject.toml`, `Dockerfile`, `docker-compose.yml` | Implementación actual simulada; FastAPI comprobado. |
| DW y hechos | `docs/dw/mvp-direct-hop.md`, `docs/dw/dimensional-model.md`, `infra/dw-schema/migrations/0009_create_constellation_facts.sql` | DW MVP implementado; hechos y grano documentados. |
| Workspace ML/roles | `infra/dw-schema/migrations/0002_create_analytical_layers_and_roles.sql`, `docs/dw/analytical-platform-foundations.md` | `ml_workspace` y `dw_ml_writer` comprobados; objeto de predicciones aún no encontrado. |
| BFF activo | `dss-monorepo/apps/bff/README.md`, `src/app/api/olap/[...path]/route.ts`, `src/app/api/_lib/auth-guard.ts` | Next.js, Keycloak, perfil activo y proxy REST OLAP comprobados. |
| Perfil/ámbito académico | `dss-monorepo/libs/shared/auth-models/src/lib/users/auth-user.ts`, `dss-monorepo/libs/rbac/src/lib/permission-map.ts` | Roles/permissions y `academicContexts` comprobados; política predictiva de ámbito no implementada. |
| IAM y OLAP | `docs/olap/autenticacion-y-autorizacion.md`, `docs/envs/auth-service.md` | JWT Keycloak y resource-server establecidos para OLAP. |
| GraphQL BFF heredado | `docker-compose.yml` referencia `gateway/graphql-bff` | Referencia presente; carpeta/código no encontrados en esta rama. |
| UI | `dss-monorepo/apps/` y documentación de Dashboards | SPA existente; recorrido predictivo no encontrado. |

## Suposiciones y huecos

- El usuario de analítica más evidente es una autoridad académica (Rector/Decano/Director), según roles DSS existentes. El operador ML es un actor propuesto; falta confirmar quién puede iniciar entrenamiento.
- El horizonte al siguiente cierre y el grano estudiante-programa-corte son propuestas inferidas del `fact_retencion_desercion`, no una decisión institucional final.
- No se confirmó autorización de lectura productiva para servicio ML ni ejecución sobre datos reales.
- No se fija hosting de modelos, cola, mecanismo SSE, SLA, umbral de alerta ni retención por falta de evidencia de carga/operación y decisiones institucionales.
- La fecha de snapshot y los metadatos de cierre son obligatorios para trazabilidad; formato físico dependerá del contrato DW vigente y volumen real.
- Los datos socioeconómicos/administrativos mencionados por la metodología/consolidado no aparecen en el DW analítico actual revisado.

## Revisión de criterios de aceptación

| Criterio PRED-001 | Evidencia en este ADR / companion docs | Estado |
|---|---|---|
| Componentes, flujo, límites y alternativas | Decisiones D1–D5, alternativas y diagramas C4/dynamic. | Documentado; propuesta pendiente de revisión. |
| Contratos versionados de dataset, job, modelo y predicción, con errores | `contracts/prediction-api-v1.yaml` y `contracts/contract-notes.md`. | Borradores v1.0; campos de negocio pendientes marcados. |
| Separación y recursos compartidos | D1, diagramas L2/dynamic, riesgos y plan PRED-008. | Mecanismo decidido; límites numéricos requieren TI. |
| Dónde consultar y autorización | D2/D4, REST vía BFF y publicación por OLAP; grants físicos quedan PRED-007. | Ruta lógica decidida; contrato de esquema pendiente. |
| Decisiones de negocio identificadas sin inventar | Tabla de abiertas D-001–D-009 y propuesta condicional. | Registrado para aprobación. |
| Matriz de trazabilidad cinco requisitos | Tabla de trazabilidad con issues/evidencia. | Documentado; confirmar descripción exacta de los IDs con backlog matriz. |
| Entregables CRISP-DM y evidencia | Plan de evolución, criterios de éxito y gates. | Documentado; evidencia real se genera en issues de ejecución. |
| Binario frente a bandas visuales | Problema de clasificación y D-009. | Binario propuesto; bandas quedan separadas y sin umbral inventado. |

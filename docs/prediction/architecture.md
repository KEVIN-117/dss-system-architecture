# Arquitectura del Motor Predictivo — C4 e inventario

Documentación de PRED-001 derivada del código y contratos que existen en esta rama. El L1–L3 y los flujos dinámicos describen la arquitectura objetivo **propuesta**, con componentes no implementados identificados en los textos. Los diagramas Mermaid individuales están en [`diagrams/`](diagrams/).

## C1 — Contexto

Muestra actores y servicios con los que el motor intercambia identidad, datos e inferencias. El operador ML es una persona propuesta hasta aprobar responsabilidades.

```mermaid
C4Context
  title Contexto C4 del motor predictivo DSS-UATF
  Person(authority, "Autoridad académica", "Consulta el riesgo dentro de su ámbito institucional")
  Person(ml_operator, "Operador ML", "Solicita entrenamiento tras autorización DSA/IAM; rol aún por definir")
  Enterprise_Boundary(dss, "DSS-UATF") {
    System(portal, "Portal DSS", "Presenta tableros y consultas")
    System(bff, "BFF DSS", "Autentica sesiones y enruta solicitudes servidor a servidor")
    System(prediction, "Motor Predictivo", "Entrena candidatos y genera inferencias trazables")
    System(dw, "Data Warehouse", "Publica datos académicos y resultados analíticos")
    System(olap, "Servicio OLAP", "Consulta el DW para análisis multidimensional")
  }
  System_Ext(keycloak, "Keycloak", "Emite tokens de acceso DSS")
  System_Ext(auth, "auth-service", "Devuelve perfil activo y contextos académicos")
  Rel(authority, portal, "Consulta indicadores")
  Rel(ml_operator, bff, "Solicita operación ML autorizada")
  Rel(portal, bff, "Solicita vistas y operaciones", "HTTPS")
  Rel(bff, keycloak, "Completa autenticación OIDC", "HTTPS")
  Rel(bff, auth, "Consulta perfil y ámbitos", "HTTPS/JSON")
  Rel(bff, prediction, "Solicita inferencia o trabajo", "REST/JSON + bearer; propuesto")
  Rel(prediction, keycloak, "Valida tokens mediante JWKS", "HTTPS")
  Rel(prediction, auth, "Resuelve perfil y contextos de autorización", "HTTPS/JSON; propuesto")
  Rel(prediction, dw, "Lee cortes autorizados y publica por contrato", "PostgreSQL; publicación por definir")
  Rel(olap, dw, "Consulta datos y predicciones publicadas", "PostgreSQL")
```

## C2 — Contenedores

La separación API/worker está recomendada por el coste variable del entrenamiento y RNF-09. El worker aún no existe. PostgreSQL DW sí es activo; el objeto de publicación predictiva y sus grants requieren PRED-007.

```mermaid
C4Container
  title Contenedores del flujo predictivo DSS-UATF
  Person(authority, "Autoridad académica", "Consulta información según sus ámbitos autorizados")
  System_Boundary(dss, "DSS-UATF") {
    Container(portal, "Portal DSS", "Next.js / React", "Interfaz académica existente")
    Container(bff, "BFF DSS", "Next.js, TypeScript", "Sesión Keycloak, autorización y proxy REST")
    Container(pred_api, "Prediction API", "Python, FastAPI", "Contrato de inferencia y control de trabajos; hoy /predict está simulado")
    Container(pred_worker, "Prediction Worker", "Python; propuesto", "Entrenamiento/evaluación aislados y scoring poblacional asíncrono")
    ContainerDb(dw_db, "PostgreSQL DW", "PostgreSQL 15", "Esquemas dw, etl_control y ml_workspace")
    Container(olap, "Servicio OLAP", "Java / Saiku", "Consultas multidimensionales sobre el DW")
  }
  System_Ext(keycloak, "Keycloak", "OIDC, tokens y JWKS")
  System_Ext(auth, "auth-service", "Perfil y academicContexts")
  Rel(authority, portal, "Consulta tableros")
  Rel(portal, bff, "Llama rutas de negocio", "HTTPS")
  Rel(bff, keycloak, "Autentica sesión", "OIDC / HTTPS")
  Rel(bff, auth, "Valida perfil activo", "HTTPS/JSON")
  Rel(bff, pred_api, "Reenvía petición y bearer", "REST/JSON; propuesto")
  Rel(pred_api, keycloak, "Verifica firma, issuer, audience y expiración", "JWKS / HTTPS")
  Rel(pred_api, auth, "Resuelve contextos de acceso", "HTTPS/JSON; propuesto")
  Rel(pred_api, dw_db, "Lee features/corte y consulta artefacto aprobado", "PostgreSQL; permisos por confirmar")
  Rel(pred_api, pred_worker, "Despacha/consulta trabajos", "Mecanismo pendiente")
  Rel(pred_worker, dw_db, "Lee snapshots, guarda artefactos ML y publica por contrato", "PostgreSQL/ML workspace; esquema/grants por definir")
  Rel(olap, dw_db, "Consulta predicciones publicadas", "PostgreSQL")
```

## C3 — Componentes de Prediction API

Describe límites internos recomendados para la API, sin afirmar que esos módulos ya estén implementados. Se detalla solo el contenedor con la mayor lógica de dominio.

```mermaid
C4Component
  title Componentes propuestos de Prediction API
  Container(bff, "BFF DSS", "Next.js", "Entrada servidor autenticada")
  Container(auth_service, "auth-service", "Spring Boot", "Perfil y contextos académicos")
  Container(keycloak, "Keycloak", "OIDC/JWKS", "Identidad y validación de token")
  Container(dw, "PostgreSQL DW", "PostgreSQL 15", "Hechos académicos, workspace ML y salida analítica")
  Container(worker, "Prediction Worker", "Python", "Ejecución asíncrona de entrenamiento/scoring")
  Container_Boundary(api, "Prediction API · FastAPI") {
    Component(router, "API Contract Router", "FastAPI / OpenAPI", "Valida esquemas y traduce errores estables")
    Component(authz, "Identity and Scope Policy", "JWT + perfil auth-service", "Verifica token y ámbito académico por solicitud")
    Component(feature_reader, "Feature Snapshot Reader", "Adaptador PostgreSQL de solo lectura", "Carga el perfil/corte y verifica el contrato de features")
    Component(inference, "Inference Use Case", "Python", "Selecciona una versión aprobada y ejecuta el pipeline inmutable")
    Component(model_catalog, "Model Version Resolver", "Repositorio ML", "Resuelve manifiestos e integridad de artefactos")
    Component(result_writer, "Prediction Publication Client", "Adaptador de persistencia", "Entrega resultados al contrato de publicación por lote")
    Component(job_api, "Training Job API", "Control de trabajos", "Autoriza inicio y consulta del estado sin entrenar en el request")
  }
  Rel(bff, router, "Llama operación y reenvía bearer", "REST/JSON")
  Rel(router, authz, "Autentica y resuelve autorización")
  Rel(authz, keycloak, "Valida firma y claims", "JWKS")
  Rel(authz, auth_service, "Consulta perfil activo y contextos", "HTTPS/JSON")
  Rel(router, inference, "Ejecuta inferencia individual")
  Rel(inference, feature_reader, "Solicita features del corte confiable")
  Rel(feature_reader, dw, "Lee relaciones aprobadas", "PostgreSQL")
  Rel(inference, model_catalog, "Resuelve modelo aprobado/versionado")
  Rel(model_catalog, dw, "Lee manifiesto/artefacto del workspace", "PostgreSQL/almacenamiento por decidir")
  Rel(router, job_api, "Crea o consulta trabajo autorizado")
  Rel(job_api, worker, "Despacha trabajo y consulta estado", "Mecanismo pendiente")
  Rel(worker, result_writer, "Entrega resultado de scoring completo")
  Rel(result_writer, dw, "Publica por contrato validado", "Relación/grants por definir")
```

## Flujos dinámicos

Los diagramas recorren el estado esperado de los contratos. El despacho de worker/estado y la publicación física siguen pendientes de elegir con PRED-003/PRED-007.

### Entrenamiento, evaluación y promoción

```mermaid
C4Dynamic
  title Flujo dinámico propuesto de entrenamiento y promoción
  Person(ml_operator, "Operador ML autorizado", "Rol pendiente de aprobación")
  Container(bff, "BFF DSS", "Next.js", "Autenticación y control de permiso")
  Container(api, "Prediction API", "FastAPI", "Control de trabajos")
  Container(worker, "Prediction Worker", "Python", "Entrenamiento y evaluación aislados")
  ContainerDb(dw, "PostgreSQL DW", "PostgreSQL", "Fuentes académicas y ML workspace")
  RelIndex(1, ml_operator, bff, "Solicita entrenamiento")
  RelIndex(2, bff, api, "POST /v1/training-jobs con bearer", "REST/JSON; propuesto")
  RelIndex(3, api, api, "Valida contrato, autorización y crea job_id")
  RelIndex(4, api, worker, "Despacha job sin esperar su terminación", "Mecanismo por decidir")
  RelIndex(5, worker, dw, "Lee solo snapshot/corte autorizado", "PostgreSQL")
  RelIndex(6, worker, worker, "Valida datos, crea particiones temporales, entrena RF/XGBoost y evalúa")
  RelIndex(7, worker, dw, "Guarda manifiesto, candidato e informe; no lo activa", "Workspace por aprobar")
  RelIndex(8, bff, api, "Consulta estado del job", "REST/JSON; polling u otro mecanismo por decidir")
  RelIndex(9, api, bff, "Devuelve estado y error saneado")
```

### Inferencia individual

```mermaid
C4Dynamic
  title Flujo dinámico propuesto de inferencia individual
  Person(authority, "Autoridad académica", "Consulta dentro de su ámbito")
  Container(portal, "Portal DSS", "Next.js / React", "Interfaz")
  Container(bff, "BFF DSS", "Next.js", "Autenticación y proxy")
  Container(api, "Prediction API", "FastAPI", "Inferencia individual")
  ContainerDb(dw, "PostgreSQL DW", "PostgreSQL", "Features, modelos y publicación analítica")
  RelIndex(1, authority, portal, "Abre consulta de riesgo")
  RelIndex(2, portal, bff, "Solicita inferencia o resultados")
  RelIndex(3, bff, api, "Reenvía bearer y solicitud", "REST/JSON; propuesto")
  RelIndex(4, api, api, "Valida identidad, ámbito, estudiante y corte")
  RelIndex(5, api, dw, "Lee features de corte permitido", "PostgreSQL")
  RelIndex(6, api, dw, "Carga una única versión aprobada", "ML workspace")
  RelIndex(7, api, bff, "Devuelve clase, probabilidad disponible, corte y versión")
  RelIndex(8, bff, portal, "Entrega resultado autorizado")
```

### Scoring poblacional y consulta analítica

```mermaid
C4Dynamic
  title Flujo dinámico propuesto de scoring y publicación poblacional
  Container(worker, "Prediction Worker", "Python", "Scoring poblacional asíncrono")
  ContainerDb(dw, "PostgreSQL DW", "PostgreSQL", "Features, versiones activas y relación de salida")
  Container(olap, "Servicio OLAP", "Java / Saiku", "Consulta analítica publicada")
  RelIndex(1, worker, dw, "Lee el snapshot autorizado del corte y su población", "PostgreSQL")
  RelIndex(2, worker, dw, "Carga exactamente una versión aprobada", "Workspace ML")
  RelIndex(3, worker, worker, "Valida elegibilidad, construye features point-in-time y calcula predicciones")
  RelIndex(4, worker, dw, "Publica lote trazable; confirma completo solo tras finalizar", "Contrato DW por definir")
  RelIndex(5, olap, dw, "Consulta lotes publicados con corte y versión explícitos", "PostgreSQL")
```

## Inventario y evidencia

| Elemento | Evidencia en el repositorio | Lectura de arquitectura |
|---|---|---|
| Prediction API | `prediction-service/main.py`, `prediction-service/pyproject.toml`, `prediction-service/Dockerfile`, `docker-compose.yml` | FastAPI desplegable, pero `POST /predict` actualmente simulado. |
| DW PostgreSQL | `docs/dw/mvp-direct-hop.md`, `docs/dw/dimensional-model.md`, `infra/dw-schema/migrations/0009_create_constellation_facts.sql` | Hechos actuales son admisión, cursado, retención/deserción; `NO_EVALUABLE` no entra en tasas ni entrenamiento. |
| Workspace ML | `infra/dw-schema/migrations/0002_create_analytical_layers_and_roles.sql`, `docs/dw/analytical-platform-foundations.md` | `ml_workspace` y `dw_ml_writer` están creados; no se halló tabla publicada de predicciones. |
| BFF activo | `dss-monorepo/apps/bff/README.md`, `dss-monorepo/apps/bff/src/app/api/olap/[...path]/route.ts`, `dss-monorepo/apps/bff/src/app/api/_lib/auth-guard.ts` | BFF Next.js valida JWT, estado activo, perfil y proxy bearer a OLAP. |
| IAM/perfil | `dss-monorepo/libs/connectors/auth-connector/src/jwt/jwt-verifier.ts`, `dss-monorepo/libs/shared/auth-models/src/lib/users/auth-user.ts`, `dss-monorepo/libs/rbac/src/lib/permission-map.ts` | Roles/permissions DSS y contextos académicos existen; no hay política ML específica. |
| OLAP | `docs/olap/autenticacion-y-autorizacion.md`, `docs/envs/olap-service.md` | Servicio REST valida bearer Keycloak como resource server. |
| Dashboard | `dss-monorepo/apps/` y documentación de portales | SPA presente; consulta predictiva no localizada. |
| GraphQL BFF citado en Compose | `docker-compose.yml` | Compose apunta a `gateway/graphql-bff`, ruta/código no encontrada en el checkout. |
| Worker de entrenamiento | No existe componente/entrypoint implementado para prediction-service. | Propuesto por RNF-09; límites de recursos aún por medir. |
| Keycloak/auth-service | Compose e `docs/envs/auth-service.md`; configuración BFF | Identidad activa y perfil conocidos; mapeo de audiencia y permiso ML por aprobar. |

## Suposiciones y huecos

- Roles del actor de consulta se apoyan en RBAC existente; Operador ML se propone y debe aprobarse.
- El worker/API separados, BFF REST y scoring individual + población son decisiones propuestas, revisables por DSA/TI cuando se confirmen carga y consumidores.
- REST/JSON es el protocolo candidato interno por coherencia con el proxy OLAP vigente; no hay endpoint predictivo real definido aún.
- No se confirmó el uso de GraphQL activo, cola, broker, registry, bucket ni filesystem persistente de modelos.
- No se confirmaron permisos productivos, requisitos de latencia, disponibilidad ni escala; RNF-09 se demostrará midiendo, no por el hecho de usar otro proceso.
- Publicación física, tabla/vista, grants y actualización OLAP se especificarán con el contrato de DW en PRED-007.
- Evento/horizonte, regla de población de primer/segundo año, umbral visual, target, criterios de aptitud y contexto de autorización requieren aprobación DSA/IAM.

## Archivos Mermaid por diagrama

- [01-context.mermaid](diagrams/01-context.mermaid)
- [02-containers.mermaid](diagrams/02-containers.mermaid)
- [03-components-api.mermaid](diagrams/03-components-api.mermaid)
- [04-dynamic-training.mermaid](diagrams/04-dynamic-training.mermaid)
- [05-dynamic-prediction.mermaid](diagrams/05-dynamic-prediction.mermaid)
- [06-dynamic-prediction-publication.mermaid](diagrams/06-dynamic-prediction-publication.mermaid)

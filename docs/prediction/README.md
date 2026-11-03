# Motor Predictivo — arquitectura y CRISP-DM

Documentación de las issues PRED-001 y PRED-002 del motor predictivo. Los contratos y análisis se versionan; los acuerdos institucionales pendientes se etiquetan en vez de asumirlos.

## Entregables

- [Plan de trabajo PRED-001](PRED-001-plan.md)
- [Acta de comprensión del negocio y plan CRISP-DM](business-understanding.md)
- [ADR-PRED-001: arquitectura y contratos](adr/0001-architecture-and-integration.md)
- [OpenAPI v1 del API predictivo](contracts/prediction-api-v1.yaml)
- [Notas semánticas, seguridad y compatibilidad del contrato](contracts/contract-notes.md)
- [Diagramas C4, flujos e inventario de evidencia](architecture.md)
- [Plan de trabajo PRED-002](PRED-002-plan.md)
- [Comprensión de datos académicos](data-understanding.md)
- [Contrato del dataset preparado v1](contracts/prepared-dataset-v1.yaml)
- [Fixture sintético PRED-002](../../prediction-service/tests/fixtures/pred002_synthetic/README.md)
- [Plan propuesto PRED-003](PRED-003-plan.md)
- [PRED-006 — Implementación de inferencia puntual](PRED-006-implementation.md)

## Estado

PRED-001 está fusionada. PRED-002 implementó el contrato del dataset preparado; se perfilaron cargas DW Faker para pruebas, sin tratarlas como evidencia institucional. PRED-006 implementa inferencia puntual separada para abandono de materia y abandono de programa, con selección de bundle por cadencia y cohorte técnica de tres años. Los candidatos Faker permanecen sin autorización de activación. Aprobación DSA de utilidad/despliegue, bundle institucional, integración en entorno coordinado y fuente temporal para predecir abandono de materia antes del resultado siguen pendientes.

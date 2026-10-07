# Datos sintéticos DW

Este directorio mantiene dos perfiles diferentes; no mezclar sus fuentes ni comandos:

## Fixture de integración DW-008

- `source/*.sql`: una fuente sintética por contrato DW-001.
- `expected/*.yml`: casos de SCD2, cierres y calidad.
- `manifest.yml`: versión, conteos, `run_id` y hashes.

Estos fixtures pequeños pertenecen exclusivamente al Compose efímero. No cargarlos en Jachasun ni en `postgres-dw` persistente. Ejecutar/restaurar solo con:

```powershell
docker compose -f infra/dw-integration/dw-integration-test.yml up --abort-on-container-exit
docker compose -f infra/dw-integration/dw-integration-test.yml down --volumes
```

Los IDs `RA-T*`, `ALUMNO-TEST-*` y `MAT-TEST-*` son referencias sintéticas de integración; no son la identidad reservada del perfil histórico.

## Perfil histórico de desarrollo

[`historical/`](historical/README.md) contiene el dataset sintético 2000–2025 para el PostgreSQL local de Jachasun, basado en su DDL y en el catálogo depurado de carreras. Se guarda en el volumen de desarrollo y exige tablas objetivo vacías antes de sembrar. No contiene filas personales reales.

Este perfil solo puebla el origen OLTP. No inserta cierres ni hechos en la base DW; el calendario DSA se prepara por separado para probar `fact_retencion_desercion` y las reglas de elegibilidad.

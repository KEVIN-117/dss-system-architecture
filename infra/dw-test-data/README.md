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

## Perfil histórico aislado recomendado

[`historical-v2/`](historical-v2/README.md) es el perfil recomendado para la demostración: usa su propio PostgreSQL efímero `jachasun_test`, puerto 55432, usuario de lectura para Hop y seed de 2000–2025. No reutiliza ni modifica el volumen persistente del Compose `dss-uatf`.

`historical/` es la revisión anterior, cuyo procedimiento apuntaba a la base persistente `jachasun`. Se conserva para trazabilidad, pero no se debe volver a sembrar ni ampliar en esa instancia. Para rehacer una prueba usa el Compose aislado de `historical-v2`.

El OLTP sintético solo puebla origen; no crea cierres ni hechos en el DW. Los 52 cierres de demostración se preparan separadamente, de manera auditable y explícitamente ficticia, con [`historical-v2/seed_dw_test_closures.sql`](historical-v2/seed_dw_test_closures.sql). Nunca ejecutar ese fixture en producción.

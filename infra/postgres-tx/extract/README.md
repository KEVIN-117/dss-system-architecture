# Consultas OLTP → Staging

Estas consultas son la implementación SQL de los contratos en `docs/dw/source-contracts`. El Load Manager las ejecutará dentro de una transacción de solo lectura y escribirá `run_id` y metadatos de corte en el manifiesto de Staging, no en las filas RAW.

Los parámetros `:snapshot_gestion` y `:snapshot_periodo` deben enlazarse como enteros. Las consultas de catálogo y perfil son snapshots completos y deliberadamente no reciben filtros de periodo. Ningún archivo de este directorio puede contener DDL, DML, joins, casts de corrección ni lógica dimensional.

# Consultas OLTP → Staging

Estas consultas son la implementación SQL de los contratos en `docs/dw/source-contracts`. El Load Manager las ejecuta dentro de una transacción de solo lectura; la integración inicial de `uatf_datos` escribe en `staging.raw_uatf_datos` y registra `run_id`, conteo y hashes en el manifiesto de control. Las demás fuentes se integrarán por etapas.

Los parámetros `:snapshot_gestion` y `:snapshot_periodo` deben enlazarse como enteros. Las consultas de catálogo y perfil son snapshots completos y deliberadamente no reciben filtros de periodo. Ningún archivo de este directorio puede contener DDL, DML, joins, casts de corrección ni lógica dimensional.

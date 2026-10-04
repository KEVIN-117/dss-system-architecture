# Extracción contractual

Las nueve consultas contractuales versionadas están en `sql/`; se ejecutan como `SELECT` de columnas explícitas sobre la tabla aprobada, sin joins analíticos ni derivaciones. Las nueve ya están conectadas a pipelines Hop con validación del esquema/filas, conteo y manifiesto auditado, y se invocan desde el smoke workflow. `test_hop_source_queries.sh` ejecuta las consultas con el principal sintético de solo lectura y comprueba conteos y filtros de corte. La prueba integrada también verifica los nueve manifiestos completos.

Respetar los filtros de snapshot y programa de cada contrato; ordenar por su clave estable; controlar timeout, nulos obligatorios, duplicados y esquema antes de declarar el manifiesto `COMPLETO`.

Usar `Table Input` con parámetros tipados y, para valores provenientes de campos, placeholders JDBC preparados; nunca construir SQL concatenando texto del usuario. Los catálogos y snapshots históricos se leen completos según la política del contrato. `public.postulantes` y sus tipos/cardinalidades aún requieren evidencia y aprobación documentada, incluso con la credencial de solo lectura confirmada.

El usuario OLTP de solo lectura fue confirmado por el responsable del proyecto. Antes de una extracción real, comprobar `current_user` y los grants efectivos mediante consultas de catálogo de solo lectura; no probar permisos ejecutando escrituras contra Jachasun. El pipeline solo registra esquema/conteos/metadatos saneados en control; la prueba 6.2 no mueve filas a RAW ni conserva muestras de datos personales. Evidencia de producción queda pendiente de validación DSA/TI.

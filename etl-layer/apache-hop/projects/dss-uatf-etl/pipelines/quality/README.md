# Calidad y gates

Las validaciones bloqueantes preceden al manifiesto completo/publicación: compatibilidad de columnas y tipos; obligatoriedad y unicidad de claves; cardinalidades autorizadas; filtros contractuales; rango de notas aprobado; referencias huérfanas; sumas de conteos y consistencia de dimensiones/hechos. Distinguir valores nulos legítimos de faltantes obligatorios.

Cada resultado de calidad debe registrar código, severidad, conteo y nombres de reglas; no poner filas, PII, contraseñas ni SQL sensible en `details`. Las reglas de `NO_EVALUABLE` y `UNKNOWN` son estados explícitos, nunca cero artificial. La ejecución se bloquea si falla una regla aprobada como blocking.

# Auditoría de fuentes de dataset

Análisis agregado y de metadatos del directorio externo `dss-uatf/dataset` (snapshot inspeccionado el 2026-10-06). No se guardaron ni mostraron filas personales. El catálogo de carreras es el único contenido institucional incorporado; las filas de graduados y personas no se copian al seed.

## Excel

| Archivo | Hojas/tamaño relevante | Hallazgos y decisión |
| --- | --- | --- |
| `data/carreras.xlsx` | 10 hojas; `fac_carreras` 87 filas × 21 columnas; `Facultades` 13 × 4 | 13 facultades; 21 registros anualizados (`A`) y 66 semestralizados (`S`) antes de depurar. Hay 86 códigos únicos porque `TST` se asigna a dos programas/facultades distintos, lo que contradice la unicidad de `alm_programas.id_programa`; se excluyen ambos registros ambiguos. Resultado: 85 códigos, 21 `A` y 64 `S`. Hay 62 LIC, 10 TUS y 13 TUM tras excluir `TST`; 73 activos y 12 inactivos; 7 duraciones no informadas. Se corrige una sustitución de carácter dañada en “DISEÑO” de `DPD`, dejando constancia de la transliteración. |
| `data/graduados_2017.xlsx` | 3 hojas; hoja principal 19.073 × 41 | Las filas describen información personal. La gestión del acto/registro cubre 2012–2026 y `egr_gestion` 1952–2023; no representa por sí sola hechos de graduación 2000–2025. Se usa solo como chequeo agregado de cobertura, no como fuente para insertar personas/graduados. |
| `data/grad_2019_2025.xlsx` | 5 hojas; `grad_kevin`, `grad_2018`, `grad_total` alrededor de 19.073 × 41/42 | Las tres hojas principales repiten las mismas 19.073 claves de registro (solapamiento total); sumarlas triplicaría conteos. La gestión de registro cubre 2012–2026 y `egr_gestion` 1952–2023. No copiar filas ni inferir graduación; la fuente futura acordada es `actas_graduacion.graduados`, aún fuera del MVP. |

## CSV (fuera de `.venv`)

| Archivo | Filas × columnas | Uso/observación |
| --- | ---: | --- |
| `data/in/finding_a_table_that__nivel_acad__column.csv` | 75 × 42 | Exploración de catálogo; no es contrato OLTP estable. |
| `data/in/jachasun_academico_aprogramas_informacion.csv` | 43 × 15 | Información de programas, formato de exportación sin cabecera confiable para sembrar. |
| `data/in/jachasun_academico_planes.csv` | 37.869 × 15 | Planes/currículos; se inspeccionó el volumen y estructura, no se copian filas en este seed porque mezclarlas con el catálogo de carreras requeriría confirmar vigencia, equivalencias y llaves en Jachasun. |
| `data/out_oltp/academico.alumnos.csv` | 18.825 × 6 | Fixture/export existente; calendario observado 2010–2024, estados observados `E/P/A`. No se copia: identificadores/atributos de alumno requieren evitar reuso aunque el generador previo fuese sintético. |
| `data/out_oltp/academico.notas_planilla.csv` | 670.797 × 7 | Calendario observado 2010–2024; periodos 1/2; estados `R/A`; notas observadas dentro de 1–100. No trae las cuatro notas parciales del DDL y excede la escala necesaria para un ciclo de prueba. |
| `data/out_oltp/alm_programas.csv` | 86 × 6 | Catálogo antiguo; se prefiere el workbook más rico, y se resuelve explícitamente la colisión `TST`. |
| `data/out_oltp/alm_programas_facultades.csv` | 13 × 3 | Catálogo antiguo; se prefiere `carreras.xlsx` para mantener la misma procedencia/clave que las carreras. |
| `data/out_oltp/colegios.csv` | 5.235 × 21 | Contiene datos de colegios reales; no se copian filas. Se crean 3 colegios sintéticos claramente marcados. |
| `data/out_oltp/localidades.csv` | 4.471 × 8 | Catálogo geográfico real; no se copian filas. Se crea una jerarquía geográfica mínima sintética para validar los joins. |
| `data/out_oltp/postulantes.personas.csv` | 25.000 × 10 | Incluye identificadores y datos personales; excluido completamente. |
| `data/out_oltp/postulantes.postulantes.csv` | 25.000 × 8 | Incluye llaves de personas/postulaciones; su calendario observado es 2010–2024, con periodos 1/2 y estados `A/R`. No se copian filas. |
| `out/carrier.csv` | 77 × 14 | Export de carreras de menor cobertura; se usa solo para comparar volumen, no para completar campos sin validar. |
| `out/fac_carrier.csv` | 82 × 13 | Export de facultades/carreras; discrepante en cardinalidad frente al workbook. No desplaza al catálogo depurado. |

Además del rango limitado 2010–2024 en los CSV transaccionales, el generador anterior usa carreras/materias dummy, notas parciales ausentes y atributos Faker. Por eso el seed no replica sus transacciones ni su modelo de identidad. Los archivos que estén dentro de `.venv` son fixtures de dependencias Python y no pertenecen al dataset académico.

## Decisiones de modelado para la prueba

1. El rango 2000–2025 se genera de forma determinista en PostgreSQL, no interpolando registros reales ni asignando años aleatorios a datos personales.
2. El Excel alimenta nombres/códigos de facultad, carrera, modalidad temporal, nivel, estado y duración; carreras sin duración conservan `NULL` como dato de catálogo.
3. La malla de materias, identidades, postulaciones, alumnos y calificaciones es sintética. Los IDs de persona usan `TEST` y no se siembran `nro_dip`, nombres, fecha de nacimiento, domicilio ni teléfono.
4. Graduación, matrícula oficial y carrera efectiva por gestión permanecen pendientes de validación funcional/técnica; no se inventan fechas de egreso ni hechos de graduación.
5. La instancia local no tiene creada `public.notas_planilla_id_matricula_seq`, aunque el default de `academico.notas_planilla.id_matricula` en el DDL apunta a esa secuencia. Para que la prueba sintética no cambie el DDL ni dependa de un default roto, el seed asigna IDs reservados explícitos a las filas de notas. Este hallazgo debe corregirse/confirmarse por separado antes de usar inserciones OLTP ordinarias en esa instancia.
6. `academico.alm_programas` no conserva el calendario anual/semestral, pero `public.fac_programas.tipo_c` sí. El perfil lo carga como catálogo auxiliar para inspección, sin modificar el allowlist de extracción DW-001 ni autorizar a Hop a consumir una décima fuente.
7. El workbook usa `activo=A/B`; los contratos DW-001 filtran `academico.alm_programas.activo` por `1/S/Y`. El seed normaliza solo el OLTP sintético a `S/N` (73 vigentes, 12 no vigentes) y conserva `A/B` en el catálogo auxiliar. Para bases sembradas con la revisión anterior existe un corrector acotado y validado por conteos.

# PRED-005 — Perfil del DW sintético para predicción

**Perfil actualizado:** 2026-11-02, tras ejecutar el ETL histórico y el backfill auditado de retención en `dss_dw`.
**Entorno:** desarrollo local. Los datos provienen del seed Faker del OLTP simulado (`dss-pred005-oltp-test`, base `jachasun_test`). No representan evidencia institucional ni reemplazan una extracción autorizada.

## Estado de la carga

El calendario sintético abarca 2000–2026. Se procesaron 79 cierres hasta 2026/1; 2026/2 y 2026/3 permanecen `PENDIENTE`. Las 156 ejecuciones registradas están `EXITOSA`; no hay ejecuciones activas ni fallidas. Los reprocesos se hicieron con transiciones auditadas y enlazados al run anterior.

| Objeto | Filas | Observación |
|---|---:|---|
| `dw.dim_estudiante` | 7.772 estándar | Versiones SCD2 de alumnos sintéticos. |
| `dw.fact_admision` | 11.850 | Hechos de admisión históricos. |
| `dw.fact_cursado` | 107.109 | Cursados/notas publicados para los cortes procesados. |
| `dw.fact_retencion_desercion` | 35.113 | Snapshots para análisis de continuidad. |

Distribución actual de `resultado_retencion`:

| Resultado | Filas |
|---|---:|
| `RETENIDO` | 26.537 |
| `DESERTOR` | 1.261 |
| `NO_EVALUABLE` | 7.315 |

`NO_EVALUABLE` se excluye del entrenamiento y no se convierte en clase negativa. Los 876 snapshots de 2025/3 y 2026/1 siguen pendientes de sucesor procesado (2026/3 y 2026/2, respectivamente). Los otros 6.439 casos no cumplen las reglas actuales de evaluabilidad, por ejemplo, por evidencia de egreso o falta de cursado siguiente con al menos dos parciales.

En los cortes recientes, 2025/1 tiene 499 snapshots: 398 `RETENIDO`, 19 `DESERTOR` y 82 `NO_EVALUABLE`. 2025/2 tiene 524: 390 `RETENIDO`, 23 `DESERTOR` y 111 `NO_EVALUABLE`. Ambos se reprocesaron tras cargar sus cierres sucesores.

## Temporalidad y cadencia

La migración `0030_exclude_future_enrollments_from_scd2.sql` filtra alumnos cuya `fec_inscripcion` es posterior al corte efectivo autorizado. En la carga actual, las 7.772 filas estándar no tienen `valid_from` anterior a `fec_inscripcion`; hay 53 valores distintos de `valid_from` entre 2000/1 y 2026/1.

El contrato de cierres usa la cadencia validada en el seed: `1→2` dentro de la misma gestión, `2→1` de la gestión siguiente y `3→3` de la gestión siguiente. La dimensión de programa no transporta la cadencia; por ello, la compatibilidad entre programa y tipo de periodo debe permanecer como control de calidad antes de certificar las etiquetas para cada modalidad.

## Aptitud para entrenamiento

La carga demuestra que el ETL, los contratos de origen, la publicación y el reproceso funcionan en el entorno sintético. La proporción de clases observada en Faker **no es evidencia institucional** y no debe utilizarse para certificar precisión, prevalencia o utilidad del modelo.

Antes de entrenar con datos institucionales todavía se requiere:

1. Una extracción DW autorizada y versionada.
2. Aprobación DSA del evento objetivo, horizonte, cohorte elegible, exclusiones y reglas de notas.
3. Una ventana de observación que respete la predicción durante los primeros dos años para programas anuales y semestrales.
4. Perfilado de cobertura, faltantes, clases, continuidad estudiante–programa y disponibilidad temporal de cada feature.
5. Verificación del contrato de snapshot de solo lectura y partición temporal agrupada por estudiante.

## Artefactos reproducibles de desarrollo

- `infra/dw-test-data/reset_dss_dw.sql`: limpia los datos sintéticos de `dss_dw`, conserva roles/migraciones, rechaza ejecuciones activas y repone miembros técnicos; verifica las 30 migraciones.
- `infra/dw-test-data/seed_dss_dw_2000_2026_calendar.sql`: carga cierres sintéticos de 2000–2026 y requiere habilitar explícitamente `dw_test.allow_synthetic_closures` en la sesión.
- `infra/dw-test-data/seed_dss_dw_2020_calendar.sql`: calendario mínimo de prueba para reproducir el escenario acotado de 2020/2.
- `tools/seed-generator/README.md`: documenta la generación del seed Faker longitudinal. El SQL generado no se versiona.

Las fechas de esos cierres son aproximadas y se identifican como sintéticas; no son cierres oficiales DSA. Las guardas de los scripts limitan el reset al DW de desarrollo y bloquean cambios mientras haya ejecuciones activas.

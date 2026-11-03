# Informe de investigación y decisiones funcionales del DW

**Fecha de reconstrucción:** 2026-11-01  
**Alcance:** reglas de admisión, cursado, abandono/retención, identidad histórica, programas y dimensión temporal para el MVP del DW académico.  
**Fuentes de reconstrucción:** respuestas del usuario/DSA compartidas en esta conversación; DDL y contratos versionados en el repositorio; consultas de análisis de solo lectura; pipelines y documentación del MVP.

> Este informe reconstruye la evidencia disponible en el repositorio y en la conversación. No afirma que todas las consultas del archivo de análisis se hayan ejecutado en producción ni sustituye los CSV de resultados de DataGrip. Cuando solo se recibió una respuesta funcional o un resultado pegado en el chat, se identifica como tal.

## 1. Dictamen ejecutivo

El DW tiene reglas suficientes para poblar y probar `FACT_ADMISION`, `FACT_CURSADO` y una versión acotada de `FACT_RETENCION_DESERCION`. La regla operativa confirmada para deserción en el MVP es **menos de dos parciales rendidos y ausencia de cursado en el siguiente cierre DSA procesado**. Cuando todavía no hay evidencia temporal suficiente, el resultado es `NO_EVALUABLE`.

No están aprobadas todas las reglas institucionales de rendimiento. En particular, siguen pendientes la precedencia entre nota final, segundo turno y examen de mesa; la fórmula de PPA y materias arrastradas; varios casos de continuidad; y la interpretación completa de la admisión fuera de los códigos `A` y `P`.

La fuente de autorización y orden operativo de la dimensión temporal del MVP es `etl_control.academic_period_closure`. `academico.dct_asignaciones` fue analizada como evidencia para reconstruir el catálogo histórico de períodos, pero no forma parte de los nueve contratos ni del flujo actual. Las fechas estimadas usadas para cierres históricos de prueba son **supuestos de test**, no fechas oficiales de Jachasun o DSA.

## 2. Alcance y fuentes consultadas

### Fuentes versionadas revisadas

- `infra/postgres-tx/ddl/ddl_jachasun.sql`: DDL local de referencia para tipos, claves y restricciones de Jachasun.
- `docs/dw/source-contracts/analisis_jachasun_read_only.sql`: suite de inspección de solo lectura, con límites de tiempo y resultados agregados.
- `docs/dw/source-contracts/01-uatf-datos.md` a `06-notas-planilla.md`: contratos de las fuentes principales relevantes para hechos y dimensiones.
- `docs/dw/source-contracts/04-programas.md`: contrato vigente de programa, versión 3.
- `docs/dw/source-contracts/prompt-validacion-dim-periodo-academico.md`: registro de la evaluación de `dct_asignaciones` como fuente candidata.
- `docs/dw/dimensional-model.md` y `docs/dw/conformed-dimensions.md`: granos, dimensiones, cierres y reglas de clasificación implementadas.
- `etl-layer/apache-hop/projects/dss-uatf-etl/pipelines/facts/README.md` y pipelines de hechos: consulta de las reglas actualmente conectadas al flujo.
- Consultas y salidas de DataGrip pegadas por el usuario durante la conversación, enumeradas en la sección 3.

También se compartieron DDL y CSV de análisis fuera del repositorio, entre ellos `dct_asignaciones`. Esos archivos externos no se vuelven a adjuntar ni se copian aquí; se consideran evidencia aportada por el usuario, no artefactos auditables dentro de este repositorio.

### Límites de la reconstrucción

- No hay en este repositorio un CSV por cada consulta productiva ejecutada ni un manifiesto con fecha, duración y cantidad exportada.
- Las salidas que sí compartió el usuario aparecen reproducidas en la sección 4, con su contexto.
- La suite `analisis_jachasun_read_only.sql` contiene consultas preparadas; que una consulta esté en ese archivo no demuestra que se haya ejecutado en el OLTP real.
- El DDL versionado sirve para contrastar la estructura esperada, pero la estructura efectiva del OLTP debe validarse contra el endpoint al que se conectará cada ambiente.

## 3. Inventario de consultas y análisis

El archivo `analisis_jachasun_read_only.sql` define una transacción `READ ONLY`, `statement_timeout` de 20 segundos y `lock_timeout` de 2 segundos. Finaliza con `ROLLBACK`. Las consultas potencialmente costosas están señaladas en sus comentarios y deben ejecutarse con autorización TI/DBA y fuera del horario operativo.

| Bloque | Consulta / análisis | Qué comprueba | Estado de evidencia disponible |
|---|---|---|---|
| 0–1 | Contexto de base, usuario, versión y modo de solo lectura | Confirma que se consulta la base esperada y que la sesión no puede escribir | La suite está documentada; no se adjunta aquí un CSV integral de esta ejecución |
| 2 | Columnas de fuentes contratadas y graduados | Nombres, orden, tipos, longitudes y nulabilidad desde `information_schema.columns` | Consulta preparada; hay otras comprobaciones puntuales de catálogo compartidas en conversación |
| 3 | Comentarios de columnas y tipos declarados | Semántica documentada de `estado`, `observacion`, notas e identidad | Consulta preparada; los comentarios de `postulantes.estado` y `notas_planilla.observacion` fueron compartidos por el usuario |
| 4–5 | Distribución y calidad de notas por gestión/período | Contrasta notas numéricas, nulos, ceros, rangos y códigos operativos | Consulta preparada; el usuario compartió la regla orientativa para `nota` y `nota_2da` |
| 6–7 | Conteo de parciales con valor no cero y distribución agregada por estudiante | Explora la señal de parciales y su relación con aprobación/reprobación | Consulta preparada; el umbral funcional final de menos de dos parciales fue confirmado después |
| 8 | Distribución de `postulantes.estado` y `estado_postulacion` | Mide dominios observados y cobertura temporal | Consulta preparada; el comentario funcional `A`/`P` fue compartido, pero no una distribución completa exportada |
| 9 | Duplicidad de claves candidatas en postulantes | Contrasta grano por `id_alumno` y por programa/corte/alumno | Consulta preparada; la implementación adopta `id_alumno` conforme al DDL local; la restricción real debe comprobarse en producción |
| 10 | Cobertura de `id_ra` y referencias | Evalúa unicidad/cobertura de personas y programa sin exportar identificadores | Consulta preparada; no se conserva aquí su CSV de resultados |
| 11–12 | Impacto de exclusiones de programas/materias y referencias huérfanas | Cuantifica los filtros analíticos explorados inicialmente | Consulta preparada. Sus listas exploratorias no deben confundirse con el filtro contractual vigente de programas |
| 13 | Cobertura de facultades para programas | Cuenta programas con y sin facultad coincidente | Consulta preparada; salida productiva agregada no archivada en este informe |
| 14 | Tablas candidatas de historia/auditoría del alumno | Busca metadatos de historia sin exponer registros personales | Consulta preparada; no se adjunta resultado CSV |
| 15–16 | Cobertura, referencias y claves candidatas de graduados | Evalúa `actas_graduacion.graduados` para una extensión futura | Consulta preparada; la fuente fue identificada como oficial, pero el hecho de graduación no pertenece al MVP |
| 17 | `ROLLBACK` | Cierra la sesión de análisis sin persistir cambios | Forma parte del script |

### Consulta funcional de notas compartida por DSA/usuario

La guía entregada para revisar aprobados, reprobados y ceros fue:

```sql
SELECT
    np.id_gestion,
    SUM(CASE WHEN GREATEST(np.nota, np.nota_2da) > 50 THEN 1 ELSE 0 END) AS ap,
    SUM(CASE
        WHEN GREATEST(np.nota, np.nota_2da) <= 50
         AND GREATEST(np.nota, np.nota_2da) > 0 THEN 1
        ELSE 0
    END) AS rep,
    SUM(CASE WHEN GREATEST(np.nota, np.nota_2da) = 0 THEN 1 ELSE 0 END) AS ab,
    COUNT(np.id_alumno) AS todo
FROM academico.notas_planilla np
JOIN academico.alumnos al ON al.id_alumno = np.id_alumno
JOIN academico.alm_programas pg ON pg.id_programa = al.id_programa
JOIN academico.pln_materias pm ON pm.id_materia = np.id_materia
WHERE np.id_periodo < 3
  AND np.id_gestion > 2012
  AND np.id_gestion < 2026
  AND pg.id_programa NOT IN ('EDI','EDT','EXI','EXQ','LAT','OJO','PCO','UTI')
  AND pm.sigla NOT IN ('PRE000','CPA360','CPA612','OPT012','OPT1','OPT2','OPT3','VJA000')
  AND np.id_materia NOT IN (3699,3700,3701,3702,3703,6516,6517,6518,6514,6515,8742,8743,8744,8876)
GROUP BY np.id_gestion
ORDER BY np.id_gestion;
```

Esta consulta es una **guía agregada** compartida para analizar `nota` y `nota_2da`; no documenta por sí sola la precedencia de `nota_ex_mesa`, no prueba que cero equivalga a inasistencia y no constituye la regla completa de `FACT_CURSADO`. El filtro `id_periodo < 3` y las listas de exclusión pertenecen a esa consulta exploratoria. El pipeline productivo vigente aplica el contrato de programas activo/tipo y procesa el corte solicitado; no se debe afirmar que aplica automáticamente todas las exclusiones de esta consulta.

## 4. Resultados puntuales compartidos

### 4.1 Catálogo de programas: longitud de `programa`

En una comparación de catálogo, se observó que el contrato esperaba `varchar(100)`, mientras Jachasun devolvió `varchar(50)`. El usuario confirmó el DDL:

```sql
programa varchar(50) NOT NULL
```

La versión vigente de `docs/dw/source-contracts/04-programas.md` recoge `varchar(50)` y registra la corrección como versión 2 del contrato. **Decisión aplicada:** validar contra 50 caracteres, no contra 100.

### 4.2 Dominio de actividad de programas

El usuario compartió esta distribución agregada observada:

| `_tipo_academico` | `activo` normalizado | Cantidad |
|---|---:|---:|
| CAR | A | 47 |
| CAR | B | 10 |
| EXT | A | 4 |
| N/A | B | 1 |
| N/A | X | 2 |
| PRO | A | 5 |
| PRO | B | 2 |
| TEM | A | 4 |
| TEM | B | 1 |

La consulta inicial de filtro no seleccionaba filas por usar valores como `1`, `S` o `Y`. DSA/TI confirmó que **`A` significa activo**; no se necesitó definir el significado de `B`. El contrato vigente incluye `_tipo_academico IN ('CAR','PRO','TES','TEM')` y `activo = 'A'` tras normalizar espacios y mayúsculas. La fila `EXT/A` se excluye por tipo, aunque su indicador sea activo.

### 4.3 Estructura y calidad de `alm_programas`

El usuario compartió una salida de verificación con 76 filas, cero campos obligatorios nulos y cero duplicados excedentes de `id_programa`. La salida también mostró la discrepancia inicial de longitud de `programa`, posteriormente resuelta con el DDL real (`varchar(50)`). La salida de constraints mostró PK y unicidad de `id_programa`, además de FK a facultad, tipo y sede.

### 4.4 Admisión y `id_acceso`

En el dataset sintético de prueba se observó que `public.postulantes.id_acceso` estaba nulo en todos los registros. Se decidió **no inventar fechas ni modalidades** para llenar `DIM_ADMISION` y `FACT_ADMISION`; el atributo ausente se representa como desconocido/técnico según el modelo. Ese hallazgo describe el dataset sintético compartido y no debe generalizarse como un resultado medido del OLTP real.

### 4.5 Dimensión de período

El usuario compartió un CSV de `academico.dct_asignaciones` y propuso:

```sql
SELECT DISTINCT id_programa, id_gestion, id_periodo
FROM academico.dct_asignaciones;
```

Los campos considerados son `id_programa`, `id_gestion` e `id_periodo`; para la clave natural de la dimensión se conserva `(gestion, periodo)`, dejando `id_programa` como evidencia de cobertura por programa. La consulta por sí sola no demuestra que el catálogo cubra toda la historia universitaria ni que aporte fechas oficiales.

Para el MVP, `etl_control.academic_period_closure` es el registro de autorización de cierres y de `effective_at`. El pipeline `pl_dim_periodo_academico_mvp.hpl` prepara `DIM_PERIODO_ACADEMICO` leyendo cierres `CERRADO` o `PROCESADO` con `effective_at` no futuro. **No sincroniza actualmente esa dimensión desde `dct_asignaciones`.**

Para pruebas históricas se acordó asumir que los ciclos incluidos en el CSV ya cerraron y asignar una fecha efectiva estimada entre el 10 y el 15 de diciembre; en la semilla revisada se usó el cierre del 15 de diciembre en hora local (representado como `2000-12-16 03:59:59+00` en el ejemplo compartido). Esto es un supuesto reproducible de test, no un registro institucional de fecha real.

## 5. Decisiones funcionales y técnicas consolidadas

### 5.1 Abandono, retención y continuidad

1. Definición general comunicada: abandono describe a quien deja de asistir; se evalúa al finalizar el semestre y se relaciona con parciales y rendimiento de materias.
2. Regla concreta posteriormente acordada para el MVP: **menos de dos parciales rendidos** basta como señal de deserción, sin agregar un umbral porcentual de aprobación.
3. La continuidad se confirma con **cursado en el siguiente cierre académico procesado**, siguiendo el orden de cierres DSA y no sumando uno al código `id_periodo`.
4. Si el cierre siguiente todavía no está procesado o la evidencia de orden temporal no es suficiente, el resultado es `NO_EVALUABLE`; no entra al denominador de tasas.
5. DSA/TI no definió el tratamiento individual de pausas, cambio de carrera, transferencia ni continuidad en otra carrera. El criterio implementado de cursado del estudiante en el siguiente cierre es el criterio del MVP; no prueba por sí solo la continuidad en el mismo programa.

### 5.2 Calificaciones y estado del cursado

- Para la guía numérica se usa `GREATEST(nota, nota_2da)`: mayor a 50 = aprobado; mayor a 0 y hasta 50 = reprobado; igual a 0 = cero candidato a abandono.
- Se indicó `id_periodo < 3` en la consulta guía. No es una regla universal de ordenamiento ni una definición de período siguiente.
- El comentario de `notas_planilla.observacion` compartido por el usuario asigna: `A` aprobado, `R` reprobado, `H` homologado, `S` compensado, `C` convalidado, `D` dictamen; `U`, `Z` y `T` se describen como desconocidos.
- La persona usuaria advirtió que esos códigos no bastan para decidir con total seguridad. El contrato vigente conserva `notas_planilla.estado` como estado operativo sin dominio aprobado; el ETL no deriva aprobación a partir de ese campo.
- **Pendiente:** precedencia institucional de `nota`, `nota_2da`, `nota_ex_mesa` y notas complementarias; efecto de homologación, compensación, convalidación y dictamen en KPIs comparables.
- Cero no se equipara automáticamente a ausencia de asistencia; los campos parciales con valor por defecto cero requieren interpretación funcional.

### 5.3 Admisión

- El comentario de DDL comunicado para `public.postulantes.estado` dice `A = EN CASO DE APROBADOS`, `P = EN CASO DE REPROBADOS`.
- El MVP interpreta solo `A` y `P`; otros valores y nulos permanecen desconocidos.
- Grano implementado: una fila por `public.postulantes.id_alumno`, sujeto a la unicidad declarada en el DDL local. La restricción debe contrastarse en la instancia real antes de tomarla como garantía productiva.
- `id_acceso` nulo en el dataset sintético no se reemplaza por datos fabricados.
- **Pendiente:** confirmación funcional de si todo `A` equivale a admisión efectiva para cada modalidad/proceso, y dominio de estados alternativos en producción.

### 5.4 Identidad e historia del estudiante

- DSA/TI indicó que `id_alumno` es el atributo/identificador histórico principal disponible.
- El modelo usa `id_alumno` como identidad canónica de SCD2; `id_ra` enriquece el perfil desde `public.uatf_datos` y puede compartirse, por lo que no se usa como clave única del estudiante.
- La fotografía actual del OLTP no permite reconstruir atributos personales pasados si no existe historia temporal en la fuente. El ETL conserva cambios observados desde sus snapshots/cierres; no afirma que reconstruye el pasado anterior a la primera captura.
- La ausencia de una fila del estudiante en un snapshot no se trata como baja.

### 5.5 PPA, arrastres y repetición

- La fórmula institucional de PPA, la definición de materia arrastrada y la forma de medir repetición siguen **sin respuesta**.
- En consecuencia, `ppa_acumulado` y `materias_arrastradas` permanecen `NULL` hasta que se aprueben fórmulas y dominios. No se calculan aproximaciones con la consulta exploratoria de notas.

### 5.6 Filtro de programas

- Confirmación funcional recibida: `activo = 'A'` identifica actividad; `B` no se interpreta como activo.
- Contrato vigente: tipos `CAR`, `PRO`, `TES`, `TEM` y activo `A`.
- `programa` tiene tipo `varchar(50)` en el DDL real compartido.
- No se incorporan silenciosamente las listas de exclusión de programas/materias de la consulta exploratoria de abandono al contrato de extracción general.

### 5.7 Alcance de hechos

- MVP: `FACT_ADMISION`, `FACT_CURSADO`, `FACT_RETENCION_DESERCION`.
- `FACT_ADMISION`: grano documentado por registro de postulante/`id_alumno`.
- `FACT_CURSADO`: grano por `notas_planilla.id_matricula`; el estado fuente se conserva sin inferir un dominio no aprobado.
- `FACT_RETENCION_DESERCION`: snapshot estudiante/programa/período cerrado; `NO_EVALUABLE` y casos no comparables quedan fuera de tasas.
- `fact_enrollment` está aplazado. `fact_graduation` está aplazado; `actas_graduacion.graduados` fue identificada como fuente oficial futura, pero requiere contrato, grano, fecha de evento y reglas propias.

## 6. Preguntas cerradas, parciales y pendientes

| Pregunta original | Estado actual | Respuesta/evidencia | Pendiente concreto |
|---|---|---|---|
| ¿Qué significa abandono? | Respondida para el MVP | Menos de dos parciales rendidos; continuidad si hay cursado en el siguiente cierre procesado | Confirmar si la señal mide abandono institucional, del programa o del estudiante; resolver transferencias/cambio de carrera |
| ¿Qué estados/notas son aprobado, reprobado y otros? | Parcial | Guía numérica con `nota`/`nota_2da`; mapa comunicado de `observacion` | Precedencia de segundo turno, examen de mesa y notas complementarias; reglas de homologación y otros códigos |
| ¿Qué `postulantes.estado` implica admisión efectiva? | Parcial | `A` aprobado; `P` reprobado; demás desconocidos | Confirmar admisión efectiva, reintentos y dominio productivo completo |
| ¿Cómo se define continuidad con pausa, cambio o transferencia? | Parcial | Cursado en el siguiente cierre procesado | Casos especiales y si la continuidad debe mantenerse en mismo programa o institución |
| ¿Cuál es la fórmula de PPA, arrastre y repetición? | Pendiente | No se aprobó fórmula | Fórmula, denominadores, materias excluidas, equivalencias y tratamiento de intentos |
| ¿Qué atributos personales son históricos? | Parcial | `id_alumno` es la identidad histórica disponible | Atributos con historia propia y fecha efectiva; cobertura anterior a la primera captura |
| ¿Cuál es el filtro de programas y actividad? | Parcial / aplicado en MVP | Activo `A`; tipos `CAR`, `PRO`, `TES`, `TEM` | Ratificación formal de alcance para cada indicador y extensiones como `EXT`/`CUR` |
| ¿Cuál es la fuente de tiempo? | Decisión de MVP tomada | `etl_control.academic_period_closure` controla cierres y `effective_at`; la dimensión se prepara desde esos cierres | Integrar/contrastar `dct_asignaciones` como catálogo histórico si se requiere cobertura anterior o detección de períodos faltantes |

## 7. Preguntas puntuales para DSA/TI

1. ¿La regla `< 2` parciales es suficiente en todos los tipos de programa, o depende de modalidad, cantidad oficial de parciales o gestión?
2. ¿“Rendido” se determina con `IS NOT NULL`, valor distinto de cero, estado de planilla u otra evidencia? ¿Cómo se distinguen cero real, ausencia y valor por defecto?
3. ¿La deserción se atribuye al estudiante en la universidad o al estudiante dentro de un programa? ¿Un cambio de carrera en el siguiente cierre cuenta como continuidad?
4. ¿Cuál es la precedencia oficial entre nota ordinaria, segundo turno, mesa y complementaria? ¿Cuál es la nota válida para aprobar cuando hay homologación, compensación, convalidación o dictamen?
5. ¿Qué valores adicionales de `postulantes.estado` y `estado_postulacion` aparecen en producción y cuál es el evento que convierte una solicitud en admisión efectiva?
6. ¿Cuál es la fórmula institucional de PPA, repetición y materias arrastradas, incluidos denominadores y materias excluidas?
7. ¿Qué atributos del estudiante disponen de historial efectivo, fuente y fecha? ¿`id_alumno` permanece estable ante cambios de carrera o fusiones de registro?
8. ¿Se ratifica para todo el DW el filtro de tipos `CAR/PRO/TES/TEM` y `activo='A'`? ¿Qué indicadores deben incluir programas de extensión, cursos u otros tipos?
9. ¿Puede DSA proporcionar o aprobar una secuencia oficial de períodos y fechas efectivas históricas para contrastar `dct_asignaciones` y los cierres de prueba?

## 8. Acciones recomendadas para cerrar la evidencia

1. Ejecutar la suite de análisis en una conexión identificada y autorizada de solo lectura; registrar base lógica, versión, fecha, duración y estado por consulta, sin host, usuario, credenciales ni datos personales.
2. Guardar un CSV UTF-8 agregado por consulta, con el SQL exacto y el resultado; los bloques de volumen deben ejecutarse con aprobación TI/DBA y límites conservadores.
3. Contrastar en el endpoint productivo los tipos, longitudes, claves y restricciones que el DDL local da por esperados, especialmente grano/unicidad de `postulantes.id_alumno`, PK de `notas_planilla.id_matricula` y catálogos usados por Hop.
4. Registrar en acta las respuestas a las preguntas abiertas de la sección 7 y versionar cambios de contrato/regla antes de modificar indicadores.
5. Mantener separadas las fechas efectivas oficiales de cierres y las fechas estimadas de semillas históricas de prueba.

## 9. Referencias de implementación

- [Contratos de fuentes DW-001](README.md)
- [Modelo dimensional](../dimensional-model.md)
- [Dimensiones conformadas](../conformed-dimensions.md)
- [Consulta de análisis de solo lectura](analisis_jachasun_read_only.sql)
- [Contrato de programas](04-programas.md)
- [Contrato de postulantes](03-postulantes.md)
- [Contrato de notas](06-notas-planilla.md)
- [Pipeline de retención/deserción](../../../etl-layer/apache-hop/projects/dss-uatf-etl/pipelines/facts/pl_fact_retencion_desercion_mvp.hpl)


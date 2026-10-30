# Mapeo del Esquema OLTP (Jachasun) y Orden Topológico de Inserción
**Proyecto:** UATF Academic DSS-DW-ML — Synthetic Seed Generator (DATA-001 / Issue #206)  
**Estándar:** Semantic Schema Mapping Manifesto (`schema-mapping` skill v1) & HEFESTO v2.0  
**Versión de Base de Datos Confirmada:** PostgreSQL 14.2 (Host `10.10.166.120`, Database `jachasun`)  
**Autor:** Worker M1 (OLTP Schema & Rules Specialist)  
**Fecha:** 2026-10-29  

---

## 1. Resumen Ejecutivo y Marco Arquitectónico

Este documento establece la especificación técnica normativa del esquema transaccional operacional (OLTP) de la Universidad Autónoma Tomás Frías (UATF), históricamente denominado **Jachasun** (registrado en DataGrip bajo el proyecto `jachasum`). 

Su propósito central es servir como **contrato de ingeniería de datos irrefutable** para el generador de datos sintéticos basado en Node.js 20+ y `@faker-js/faker` v10 (Issue #206), asegurando tres objetivos críticos:
1. **Fidelidad Estructural Absoluta:** Mapeo de las 26 tablas físicas transaccionales y maestras confirmadas mediante introspección directa de catálogo en PostgreSQL 14.2 (`information_schema` y `pg_catalog`).
2. **Saneamiento de Columnas Fantasma:** Eliminación explícita de **24 columnas obsoletas o inexistentes** heredadas del archivo de respaldo local `infra/postgres-tx/ddl/ddl_jachasun.sql` (PostgreSQL 9.3) que provocan fallos de ejecución en tiempo de carga (`column does not exist`).
3. **Grafo Topológico en 8 Niveles (Zero-FK Violations):** Definición de una secuencia de inserción determinista y libre de ciclos que permite poblar la base de datos de 0 a 100% sin requerir desactivación de restricciones ni permisos de superusuario (`SET session_replication_role = 'replica'`).

---

## 2. Inventario de Discrepancias Estructurales (24 Columnas Fantasma Descartadas)

El análisis comparativo entre el DDL local histórico (`ddl_jachasun.sql`) y la base de datos activa introspeccionada en PostgreSQL 14.2 reveló una deriva estructural severa. La siguiente tabla identifica formalmente las **24 columnas fantasma** que **NUNCA deben ser generadas ni referenciadas** por el generador de seed ni por los pipelines de extracción:

| # | Tabla Física Confirmada | Columna Fantasma en DDL Local | Tipo en DDL | Razón de Inexistencia / Impacto Técnico si se Invoca |
|:-:|:---|:---|:---|:---|
| 1 | `public.postulantes` | `nro_impresiones` | `integer` | Columna técnica de emisión de comprobantes en caja; nunca creada en producción. |
| 2 | `public.postulantes` | `recalificado` | `boolean` | Flag de proceso manual descartado en la versión 14.2. |
| 3 | `public.postulantes` | `id_recaudaciones` | `integer` | Intento de acoplamiento con sistema financiero DAF no desplegado. |
| 4 | `public.postulantes` | `id_postulaciones` | `integer` | Clave sustituta redundante; la identidad operacional única es `id_alumno`. |
| 5 | `public.postulantes` | `estado_postulacion` | `varchar(15)` | **CRÍTICO:** Columna causante del error documentado en el análisis de lectura de DW. El estado de postulación real es `estado char(1)` ('A' = Aprobado, 'P' = Reprobado). |
| 6 | `public.postulantes` | `estado_envio_daf` | `char(1)` | Flag de sincronización bancaria inexistente. |
| 7 | `academico.pln_materias` | `imprimir_certificado` | `boolean` | Parámetro de UI de impresión de kardex no persistido en tabla física. |
| 8 | `academico.pln_materias` | `hrs_semana` | `smallint` | Propuesta de carga horaria semanal redundante; el OLTP utiliza `hrs_teoricas` y `hrs_practicas`. |
| 9 | `academico.pln_materias` | `hrs_semestre` | `smallint` | Carga semestral calculada dinámicamente; no existe como columna. |
| 10| `academico.pln_materias` | `creditos` | `smallint` | **ALTO:** El campo oficial de créditos en PostgreSQL 14.2 es `_creditos smallint`. `creditos` provoca colisión inmediata. |
| 11| `academico.pln_materias` | `hrs_total` | `smallint` | Suma de horas no almacenada físicamente. |
| 12| `academico.pln_materias` | `porcentaje_evaluacion`| `numeric(5,2)` | Regla de ponderación pedagógica no implementada en la tabla maestra. |
| 13| `academico.alm_programas` | `clave_certificado` | `varchar(32)` | Token de seguridad criptográfica web ausente en el esquema de base de datos. |
| 14| `academico.alm_programas` | `name_programa` | `varchar(100)` | Atributo duplicado en inglés; el nombre canónico es `programa varchar(50)`. |
| 15| `academico.alm_programas` | `carnet_universitario` | `boolean` | Flag administrativo no existente. |
| 16| `academico.alm_programas` | `tiene_tramites` | `boolean` | Flag de portal estudiantil no desplegado. |
| 17| `academico.alm_programas` | `tiempo_estudio` | `smallint` | **MEDIO:** La duración en años reside en `fac_programas.tiempo_estudio`; en `alm_programas` fue eliminada. |
| 18| `academico.alm_programas` | `tipo_estadisticas` | `varchar(10)` | Agrupador estadístico legado fuera de uso. |
| 19| `public.uatf_datos` | `id_apoderado` | `varchar(10)` | Módulo de tutor/apoderado escolar nunca migrado a nivel universitario. |
| 20| `public.uatf_datos` | `id_colegio_sie` | `varchar(16)` | El enlace a colegios se realiza exclusivamente vía `id_colegio integer -> prs_colegios.id_colegio`. |
| 21| `public.uatf_datos` | `estado_profesional` | `char(1)` | Indicador laboral no estandarizado. |
| 22| `academico.alumnos` | `id_tipo_matricula` | `smallint` | Obsoleto; la tipificación de matrícula se gestiona en `academico.alm_programaciones`. |
| 23| `academico.alumnos` | `nivel_acad` | `varchar(10)` | El nivel académico reside en `alm_programas.nivel` ('LIC', 'TUS', 'TUM'). |
| 24| `academico.notas_planilla` | `_hash` | `varchar(64)` | Hash técnico experimental introducido en fixtures de prueba; no existe en la tabla física de producción. |

*(Nota complementaria: En `public.lugar_localidad` existen 2 columnas legadas en DDL `_actualizado` e `id_procedencia` que tampoco existen en la tabla real de 10 columnas).*

---

## 3. Grafo Topológico de Inserción en 8 Niveles (Zero-FK Violations)

Para garantizar la inserción determinista de datos generados mediante scripts TypeScript / Node.js sin provocar errores de clave foránea (`FOREIGN KEY constraint violation`) y sin apagar validaciones de integridad referencial, las tablas deben poblarse en estricto orden de dependencias acíclicas en 8 niveles:

```
========================================================================================
NIVEL 0: CATÁLOGOS INDEPENDIENTES RAÍZ (Tablas sin claves foráneas salientes)
  [1] public.prs_pais_v2
  [2] public._bp_estados_civiles
  [3] public.prs_calificacion
  [4] public.prs_examen
  [5] academico.alm_programas_facultades
  [6] academico.carreras_tipos
  [7] academico.sedes
  [8] academico.alumnos_estados
  [9] academico.periodos
  [10] academico.docentes_tiempo
========================================================================================
                                      │
                                      ▼
========================================================================================
NIVEL 1: JERARQUÍA GEOGRÁFICA Y ESTRUCTURA PROGRAMÁTICA BASE
  [11] public.lugar_departamento          (FK -> prs_pais_v2)
  [12] academico.alm_periodos             (Auto-enlace reflexivo: id_periodo_relacion = id_periodo)
  [13] academico.alm_programas            (FKs -> alm_programas_facultades, carreras_tipos, sedes)
========================================================================================
                                      │
                                      ▼
========================================================================================
NIVEL 2: PROVINCIAS, PROGRAMAS DESNORMALIZADOS Y ASIGNATURAS BASE
  [14] public.lugar_provincia             (FKs -> lugar_departamento, prs_pais_v2)
  [15] public.fac_programas               (Catálogo complementario con tipo_c 'S'/'A')
  [16] academico.docentes                 (FKs -> alm_programas, docentes_tiempo)
  [17] academico.pln_materias (Paso 1)   (Materias Semestre/Ciclo 1: id_materia_padre = NULL)
========================================================================================
                                      │
                                      ▼
========================================================================================
NIVEL 3: LOCALIDADES Y MALLA CURRICULAR CON PRERREQUISITOS
  [18] public.lugar_localidad             (FKs -> lugar_provincia, lugar_departamento, prs_pais_v2)
  [19] academico.pln_materias (Paso 2)   (Materias Ciclos 2-10: id_materia_padre -> pln_materias)
========================================================================================
                                      │
                                      ▼
========================================================================================
NIVEL 4: UNIDADES EDUCATIVAS Y ASIGNACIÓN DE CARGA DOCENTE
  [20] public.prs_colegios                (FK -> lugar_localidad)
  [21] academico.dct_asignaciones         (FKs -> alm_programas, pln_materias, docentes)
========================================================================================
                                      │
                                      ▼
========================================================================================
NIVEL 5: IDENTIDAD CIUDADANA Y PADRÓN DEMOGRÁFICO MAESTRO
  [22] public.uatf_datos                  (FKs -> _bp_estados_civiles, prs_calificacion, 
                                                  lugar_localidad, prs_colegios, prs_pais_v2)
========================================================================================
                                      │
                                      ▼
========================================================================================
NIVEL 6: POSTULACIONES DE ADMISIÓN Y ESTUDIANTES MATRICULADOS
  [23] public.postulantes                 (FK semántica -> uatf_datos, alm_programas)
  [24] academico.alumnos                  (FKs -> uatf_datos, alm_programas, alumnos_estados, prs_examen)
========================================================================================
                                      │
                                      ▼
========================================================================================
NIVEL 7: TRANSACCIONES ACADÉMICAS, CALIFICACIONES Y TITULACIÓN
  [25] academico.alm_programaciones       (FKs -> alumnos, pln_materias, alm_periodos)
  [26] academico.notas_planilla           (FKs -> alumnos, pln_materias)
  [27] actas_graduacion.graduados         (FKs -> alumnos, alm_programas)
========================================================================================
```

### 3.1. Estrategia de Resolución de Dependencias Circulares y Auto-Referencias

1. **Auto-referencia en Asignaturas (`academico.pln_materias.id_materia_padre`):**
   - **Problema:** Cada materia avanzada tiene como prerrequisito una materia anterior mediante `id_materia_padre REFERENCES pln_materias(id_materia)`.
   - **Solución Topológica en 2 Pasos:**
     - *Paso 1 (Nivel 2):* Insertar la totalidad de asignaturas del **Ciclo 1 (primer semestre / año)** asignando explícitamente `id_materia_padre = NULL`.
     - *Paso 2 (Nivel 3):* Insertar en cascada progresiva las asignaturas de los **Ciclos 2 al 10**, vinculando `id_materia_padre` con los IDs de asignaturas previamente insertadas en ciclos inferiores.
2. **Auto-referencia en Períodos (`academico.alm_periodos.id_periodo_relacion`):**
   - **Problema:** La columna `id_periodo_relacion` es `NOT NULL` y posee restricción foránea contra `alm_periodos(id_periodo)`.
   - **Solución:** Para la inicialización del catálogo base (códigos 0 al 7), insertar filas asignando reflexivamente `id_periodo_relacion = id_periodo`.
3. **Desacoplamiento Estructural Postulante ↔ Alumno:**
   - En `public.postulantes`, la columna `id_alumno` es una secuencia numérica interna de postulación (`UNIQUE (id_alumno)`) y **no tiene clave foránea física** hacia `academico.alumnos.id_alumno`.
   - La correspondencia de negocio se realiza por el par natural `(id_ra, id_programa)`. De este modo, un postulante puede reprobar (`estado = 'P'`) sin existir en `academico.alumnos`, mientras que los postulantes admitidos (`estado = 'A'`) generan posteriormente su registro en `academico.alumnos` compartiendo el mismo `id_ra`.

---

## 4. Diccionario Físico Exhaustivo de las 26 Tablas Confirmadas

A continuación se detalla la especificación de catálogo de las 26 tablas confirmadas en PostgreSQL 14.2, indicando tipos exactos, nulabilidad, llaves primarias, llaves foráneas y unicidad.

### Nivel 0: Catálogos Independientes Raíz

#### 1. `public.prs_pais_v2`
- **Propósito:** Catálogo oficial de países de nacionalidad y nacimiento.
- **Granularidad:** Un registro por país reconocido.
- **Clave Primaria:** `id_pais` (`integer`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_pais` | `integer` | NOT NULL | `nextval('prs_pais_2_id_pais_seq')` | PK |
  | `pais` | `varchar(255)` | NULL | - | Nombre del país (ej. 'BOLIVIA', 'ARGENTINA') |
  | `calificacion` | `smallint` | NULL | - | Código interno |
  | `num_materias` | `smallint` | NULL | - | Parámetro académico |
  | `estado` | `varchar(1)` | NULL | `'A'` | 'A' = Activo, 'I' = Inactivo |

#### 2. `public._bp_estados_civiles`
- **Propósito:** Catálogo maestro de estado civil del ciudadano.
- **Granularidad:** Un registro por estado civil normativo.
- **Clave Primaria:** `id_estado_civil` (`serial`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_estado_civil` | `integer` | NOT NULL | `nextval('_bp_estados_civiles_id_seq')`| PK |
  | `cod_estado_civil`| `varchar(3)` | NULL | - | 'SOL', 'CAS', 'DIV', 'VIU' |
  | `estado_civil` | `char(50)` | NOT NULL | - | Descripción completa |
  | `_registrado` | `timestamp` | NOT NULL | `now()` | Auditoría de creación |
  | `_modificado` | `timestamp` | NOT NULL | `now()` | Auditoría de modificación |
  | `_id_usuario` | `char(20)` | NULL | `'root'` | Usuario auditor |
  | `_estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activo |
  | `_is2doa` | `boolean` | NULL | `false` | Bandera técnica |

#### 3. `public.prs_calificacion`
- **Propósito:** Clasificación de procedencia socioeducativa del postulante.
- **Granularidad:** Un registro por tipo de colegio o condición.
- **Clave Primaria:** `id_calificacion` (`varchar(1)`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_calificacion` | `varchar(1)` | NOT NULL | - | PK: '1' (Fiscal), '2' (Particular), 'B' (Profesional), 'X' (Extranjero) |
  | `calificacion` | `varchar(20)` | NOT NULL | - | Descripción textual del régimen |

#### 4. `public.prs_examen`
- **Propósito:** Modalidad o tipo de prueba de admisión universitaria.
- **Granularidad:** Un registro por modalidad de examen/ingreso.
- **Clave Primaria:** `id_examen` (`integer`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_examen` | `integer` | NOT NULL | - | PK (1 = PSA, 2 = Preuniversitario, etc.) |
  | `examen` | `varchar` | NOT NULL | - | Nombre descriptivo de la modalidad |
  | `costo` | `integer` | NULL | 0 | Arancel de matrícula/postulación |
  | `obs` | `varchar(32)` | NULL | - | Observación técnica |
  | `abreviacion` | `varchar(25)` | NULL | - | Sigla oficial (ej. 'PSA', 'CPU', 'ADEA') |
  | `_estado` | `varchar(16)` | NOT NULL | `'REGISTRADO'` | Estado del registro |
  | `peso` | `smallint` | NULL | 1 | Ponderación |
  | `_registrado` | `timestamp` | NOT NULL | `now()` | Auditoría |
  | `fecha_inicio` | `date` | NULL | - | Vigencia inicial |
  | `fecha_fin` | `date` | NULL | - | Vigencia final |
  | `planificacion` | `smallint` | NOT NULL | 0 | Código de planificación |
  | `__tipo` | `smallint` | NOT NULL | 1 | Subtipo |
  | `_requisitos` | `varchar[]` | NULL | - | Arreglo de requisitos |
  | `_img` | `varchar` | NULL | - | Ruta imagen |
  | `_ncosto` | `varchar` | NULL | - | Representación literal |
  | `_form` | `varchar` | NULL | - | Identificador de formulario |
  | `r_requisitos_b` | `varchar[]` | NULL | - | Requisitos adicionales |
  | `_requisitos_anteriores_2021` | `text` | NULL | - | Histórico de requisitos |
  | `modalidad` | `varchar` | NOT NULL | `''` | Categoría institucional |
  | `tipo_postulacion` | `varchar` | NOT NULL | `'NORMAL'` | 'NORMAL', 'ESPECIAL' |
  | `id_concepto` | `varchar` | NULL | - | Código DAF de recaudaciones |
  | `id_mod_grupo` | `integer` | NULL | - | Grupo de modalidad |

#### 5. `academico.alm_programas_facultades`
- **Propósito:** Facultades universitarias (máximo nivel jerárquico académico).
- **Granularidad:** Una fila por facultad (13 facultades oficiales).
- **Clave Primaria:** `id_facultad` (`integer`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_facultad` | `integer` | NOT NULL | - | PK (1 a 13) |
  | `facultad` | `varchar(100)`| NOT NULL | - | Nombre completo oficial |
  | `facu_abre` | `varchar(50)` | NULL | - | Abreviación institucional (ej. 'FAC. DE CIENCIAS PURAS') |
  | `direccion` | `varchar(80)` | NULL | - | Dirección física del decanato |
  | `telefono` | `varchar(10)` | NULL | - | Teléfono oficial |
  | `estado` | `char(1)` | NULL | `'A'` | 'A' = Activo |
  | `fec_creacion` | `date` | NULL | - | Fecha de fundación |
  | `escudo` | `char(60)` | NULL | - | Archivo gráfico del escudo |
  | `imagen` | `char(60)` | NULL | - | Imagen de fachada |
  | `estadovirtual` | `char(1)` | NULL | - | Flag campus virtual |
  | `decano` | `integer` | NULL | - | ID de autoridad |
  | `web` | `varchar(50)` | NULL | - | Portal web oficial |
  | `fax` | `varchar(10)` | NULL | - | Línea de fax |
  | `email` | `varchar(35)` | NULL | - | Correo electrónico de contacto |
  | `proceso_historico`| `text` | NULL | - | Reseña histórica |
  | `vision` | `text` | NULL | - | Declaración de visión |
  | `mision` | `text` | NULL | - | Declaración de misión |

#### 6. `academico.carreras_tipos`
- **Propósito:** Tipos de oferta académica universitaria.
- **Granularidad:** Un registro por tipo de titulación/régimen.
- **Clave Primaria:** `tipo` (`varchar(1)`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `tipo` | `varchar(1)` | NOT NULL | - | PK: 'C' (Carrera), 'P' (Programa) |
  | `descripcion` | `varchar` | NULL | - | Descripción completa |
  | `semanas` | `smallint` | NULL | - | Semanas lectivas (20 semestral, 40 anual) |

#### 7. `academico.sedes`
- **Propósito:** Campus y sedes universitarias físicas de la UATF en Potosí.
- **Granularidad:** Una fila por sede geográfica.
- **Clave Primaria:** `id_sede` (`varchar`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_sede` | `varchar` | NOT NULL | - | PK: 'C' / '1' (Central), '2' (Llica), '3' (Sacaca), '4' (Tupiza), '5' (Uncía), '6' (Uyuni), '7' (Villazón), '8' (San Cristóbal) |
  | `sede` | `varchar` | NULL | - | Nombre de la sede física |

#### 8. `academico.alumnos_estados`
- **Propósito:** Estados de vida académica de los estudiantes matriculados.
- **Granularidad:** Un registro por estado académico regulatorio.
- **Clave Primaria:** `estado` (`varchar(1)`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `estado` | `varchar(1)` | NOT NULL | - | PK: 'P' (Regular), 'B' (Bloqueado), 'A' (Profesional), 'X' (Anulado), 'T' (Titulado), 'S' (Simultánea) |
  | `descripcion` | `varchar` | NULL | - | Significado reglamentario DSA |

#### 9. `academico.periodos`
- **Propósito:** Catálogo institucional general de períodos lectivos anuales.
- **Granularidad:** Un registro por código de período (0 al 7).
- **Clave Primaria:** No tiene PK formal en DDL, pero `id_periodo` opera como clave lógica.
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_periodo` | `integer` | NULL | - | Código (0 a 7) |
  | `des_periodo` | `varchar` | NULL | - | Descripción del período |
  | `orden` | `smallint` | NULL | - | Secuencia ordinal cronológica |
  | `tipo` | `char(1)[]` | NULL | - | Tipo de término |

#### 10. `academico.docentes_tiempo`
- **Propósito:** Catálogo de dedicación horaria docente.
- **Granularidad:** Un registro por tipo de dedicación.
- **Clave Primaria:** `tiempo` (`varchar`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `tiempo` | `varchar` | NOT NULL | - | PK: 'TC' (Tiempo Completo), 'MT' (Medio Tiempo), 'TH' (Tiempo Horario) |
  | `descripcion` | `varchar` | NULL | - | Descripción del régimen laboral |
  | `horas` | `integer` | NULL | - | Horas semanales contratadas (40, 20, 10) |

---

### Nivel 1: Jerarquía Geográfica y Estructura Programática Base

#### 11. `public.lugar_departamento`
- **Propósito:** Departamentos de Bolivia y regiones geográficas de procedencia.
- **Granularidad:** Una fila por departamento.
- **Clave Primaria:** `cod_dep` (`integer`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `cod_dep` | `integer` | NOT NULL | `nextval('lugar_departamento_v2_cod_dep_seq')` | PK |
  | `departamento` | `char(15)` | NOT NULL | - | Nombre (ej. 'POTOSI', 'CHUQUISACA') |
  | `cod_pais` | `integer` | NOT NULL | - | FK -> `prs_pais_v2(id_pais)` |
  | `_registro` | `timestamp` | NOT NULL | `now()` | Auditoría de creación |
  | `expedido` | `varchar` | NULL | - | Código de emisión de CI ('PT', 'CH', 'LP') |

#### 12. `academico.alm_periodos`
- **Propósito:** Períodos lectivos específicos para programación de materias.
- **Granularidad:** Un registro por término académico con auto-enlace reflexivo.
- **Clave Primaria:** `id_periodo` (`smallint`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_periodo` | `smallint` | NOT NULL | - | PK: 0 a 7 |
  | `descripcion` | `varchar` | NULL | - | 'Primer Semestre', 'Segundo Semestre', etc. |
  | `id_periodo_relacion`| `smallint` | NOT NULL | - | FK reflexiva -> `alm_periodos(id_periodo)` |

#### 13. `academico.alm_programas`
- **Propósito:** Catálogo maestro de carreras y programas académicos de pregrado de la UATF.
- **Granularidad:** Un registro por carrera/programa ofertado (`id_programa`).
- **Clave Primaria:** `id_programa` (`char(3)`, NOT NULL, PK / UNIQUE).
- **Columnas (42 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_programa` | `char(3)` | NOT NULL | - | PK / UNIQUE: Código canónico (ej. 'SIS', 'CIV', 'MED', 'DER') |
  | `programa` | `varchar(50)` | NOT NULL | - | Nombre completo oficial de la carrera |
  | `id_facultad` | `smallint` | NOT NULL | - | FK -> `alm_programas_facultades(id_facultad)` |
  | `id_nivel` | `smallint` | NOT NULL | 1 | 1 = Licenciatura, 2 = TUS, 3 = TUM |
  | `titulo` | `varchar(45)` | NOT NULL | - | Título profesional emitido en provisión nacional |
  | `activo` | `varchar` | NULL | `'A'` | 'A' = Activo, 'B' = Inactivo |
  | `nivel` | `varchar(45)` | NULL | - | 'LIC', 'TUS', 'TUM' |
  | `tipo` | `varchar` | NULL | - | FK -> `carreras_tipos(tipo)`: 'C' o 'P' |
  | `fec_creacion` | `date` | NULL | - | Fecha de fundación de la carrera |
  | `anulacion_parc` | `varchar(2)` | NULL | - | Código interno |
  | `fecha_aprob_curriculo`| `date` | NULL | - | Aprobación del plan curricular |
  | `fecha_creacion`| `date` | NULL | - | Fecha histórica |
  | `resol_hcu` | `char(10)` | NULL | - | Resolución del Honorable Consejo Universitario |
  | `resol_dsa` | `char(10)` | NULL | - | Resolución de la Dirección de Servicios Académicos |
  | `resol_hcf` | `char(10)` | NULL | - | Resolución del Consejo Facultativo |
  | `cert_ceub` | `char(10)` | NULL | - | Certificación del CEUB |
  | `direccion` | `varchar(80)` | NULL | - | Dirección física de la dirección de carrera |
  | `fax` | `varchar(10)` | NULL | - | Línea de fax |
  | `telefono` | `varchar(10)` | NULL | - | Teléfono institucional |
  | `casilla` | `varchar(10)` | NULL | - | Casilla postal |
  | `email` | `varchar(35)` | NULL | - | Correo oficial |
  | `web` | `varchar(50)` | NULL | - | Portal web |
  | `num_2doturno_permitido`| `integer`| NULL | 2 | Cupo máximo de materias en 2do turno |
  | `nota_min_paralela`| `integer` | NULL | 51 | Umbral de aprobación |
  | `escudo` | `char(60)` | NULL | - | Ruta imagen escudo |
  | `imagen` | `char(60)` | NULL | - | Ruta imagen portada |
  | `id_plan` | `smallint` | NULL | - | Plan de estudios activo |
  | `id_materia_pre000`| `smallint` | NULL | - | Asignatura de nivelación |
  | `nota_minima` | `integer` | NULL | 51 | Nota mínima general de aprobación |
  | `sede` | `varchar(1)` | NULL | `'C'` | FK -> `sedes(id_sede)`: 'C', '1'..'8' |
  | `director` | `integer` | NULL | - | ID de autoridad docente |
  | `_tipo_academico`| `char(3)` | NOT NULL | `'CAR'` | **CRÍTICO PARA DW:** 'CAR' (Carrera), 'PRO' (Programa), 'TES', 'TEM', 'EXT' |
  | `_tiene_examen_mesa`| `boolean`| NULL | `true` | Admite examen de mesa |
  | `id_programa_padre`| `char(3)`| NULL | - | Código de carrera madre si es subsede |
  | `num_parc` | `smallint` | NOT NULL | 4 | Número de parciales oficiales |
  | `moodle` | `smallint` | NULL | 1 | ID integración LMS |
  | `nota_2do_habilitacion`| `smallint`| NOT NULL| 40 | Umbral mínimo para habilitar 2da instancia |
  | `pabreviacion` | `varchar` | NULL | - | Nombre corto de la carrera |
  | `id_edificio` | `smallint` | NOT NULL | 1 | Código de infraestructura |
  | `nro_max_arrastres`| `integer` | NOT NULL | 2 | Máximo de asignaturas reprobadas simultáneas |
  | `tipo_cobro` | `varchar` | NOT NULL | `'NORMAL'`| Arancel de matrícula |
  | `documento` | `bytea` | NULL | - | Documento binario de acreditación |

---

### Nivel 2: Provincias, Programas Desnormalizados y Asignaturas Base

#### 14. `public.lugar_provincia`
- **Propósito:** Provincias de Bolivia pertenecientes a cada departamento.
- **Granularidad:** Un registro por provincia.
- **Clave Primaria:** `cod_prov` (`integer`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `cod_prov` | `integer` | NOT NULL | `nextval('lugar_provincia_cod_prov_2_seq')` | PK |
  | `cod_dep` | `smallint` | NULL | - | FK -> `lugar_departamento(cod_dep)` |
  | `cod_prov_original`| `smallint`| NULL | - | Código del censo original |
  | `provincia` | `varchar(40)`| NULL | - | Nombre (ej. 'TOMAS FRIAS', 'SUD CHICHAS') |
  | `cod_pais` | `integer` | NULL | - | FK -> `prs_pais_v2(id_pais)` |
  | `cod_prov_2` | `integer` | NULL | - | Clave de homologación |

#### 15. `public.fac_programas`
- **Propósito:** Catálogo desnormalizado complementario de facultades y programas que define el régimen de estudios (`tipo_c`: 'S' Semestral, 'A' Anual) y la duración en años.
- **Granularidad:** Un registro por carrera/programa.
- **Columnas Clave:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_programa` | `varchar(3)` | NOT NULL | - | Clave de enlace con `alm_programas` |
  | `programa` | `varchar` | NOT NULL | - | Nombre descriptivo |
  | `id_facultad` | `varchar` | NOT NULL | - | Código de facultad |
  | `tipo_c` | `varchar(1)` | NOT NULL | - | **RÉGIMEN TEMPORAL:** 'S' (Semestral: 64 programas), 'A' (Anual: 21 programas) |
  | `tiempo_estudio`| `smallint` | NULL | - | Duración teórica de la carrera (años: 2, 3, 4, 5, 6) |
  | `activo` | `varchar(1)` | NULL | `'A'` | Estado |
  | `id_sede` | `integer` | NULL | 1 | Código de sede |

#### 16. `academico.docentes`
- **Propósito:** Cuerpo docente universitario de la UATF.
- **Granularidad:** Un registro por docente contratado o titular.
- **Clave Primaria:** `id_docente` (`integer`, NOT NULL, PK).
- **Columnas:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_docente` | `integer` | NOT NULL | - | PK |
  | `nombres` | `varchar(25)` | NOT NULL | - | Nombres de pila |
  | `paterno` | `varchar(20)` | NULL | - | Primer apellido |
  | `materno` | `varchar(20)` | NULL | - | Segundo apellido |
  | `clave` | `varchar(50)` | NOT NULL | - | Contraseña hash |
  | `estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activo |
  | `ci` | `varchar` | NULL | - | Cédula de identidad |
  | `fec_nac` | `date` | NULL | - | Fecha de nacimiento |
  | `id_programa` | `char(3)` | NULL | - | FK -> `alm_programas(id_programa)` |
  | `tiempo` | `varchar(3)` | NULL | - | FK -> `docentes_tiempo(tiempo)` ('TC', 'MT', 'TH') |
  | `usuario` | `varchar(30)` | NULL | - | UNIQUE: Nombre de usuario |

#### 17. `academico.pln_materias` (Paso 1: Asignaturas Base del Ciclo 1)
- **Propósito:** Malla curricular — Inserción de asignaturas del **primer semestre o año**, sin prerrequisito.
- **Granularidad:** Un registro por asignatura de ciclo 1.
- **Clave Primaria:** `id_materia` (`integer`, NOT NULL, PK).
- **Columnas (26 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_materia` | `integer` | NOT NULL | `nextval('pln_materias1_ne_id_materia_seq')` | PK (Debe ser $\le 32767$ por compatibilidad con `notas_planilla`) |
  | `sigla` | `char(7)` | NOT NULL | - | Código oficial (ej. 'SIS-111', 'MAT-101') |
  | `materia` | `varchar` | NOT NULL | - | Nombre de la asignatura (ej. 'CALCULO I') |
  | `hrs_teoricas` | `smallint` | NULL | 0 | Horas semanales teóricas (e.g. 4) |
  | `hrs_practicas`| `smallint` | NULL | 0 | Horas semanales prácticas (e.g. 2) |
  | `ciclo` | `integer` | NULL | 1 | Nivel semestral o anual (1 para Paso 1) |
  | `id_dpto` | `char(3)` | NULL | `'1'` | '1' = Materia Activa, '0' = Inactiva |
  | `hrs_laboratorio`| `smallint`| NULL | 0 | Horas de laboratorio |
  | `id_programa` | `char(3)` | NULL | - | FK -> `alm_programas(id_programa)` |
  | `color` | `char(7)` | NULL | `'#000000'`| Color en pensum gráfico |
  | `nivel_academico`| `smallint`| NULL | 1 | 1 = Licenciatura, 2 = TUS, 3 = TUM |
  | `grupom` | `varchar` | NULL | `'XXXX'` | Agrupador de área (ej. 'MAT', 'FIS', 'SIS') |
  | `mension` | `integer` | NULL | 0 | 0 = Tronco común, >0 = Mención/Electiva |
  | `control` | `bigint` | NULL | 0 | Campo técnico |
  | `id_plan` | `integer` | NULL | 2018 | Año del plan de estudios (ej. 2018) |
  | `_estado` | `varchar(16)`| NOT NULL | `'REGISTRADO'` | Estado de la materia |
  | `nota_minima` | `smallint` | NOT NULL | 51 | 51 (general UATF), 56 (Auditoría) |
  | `tiene_viaje_practica`| `boolean`| NULL| `false`| Requiere viaje de campo |
  | `mostrarnotas` | `boolean` | NULL | `true` | Visible en portal estudiante |
  | `atributos` | `varchar[]` | NULL | - | Arreglo de metadatos pedagógicos |
  | `_obs` | `varchar` | NOT NULL | `''` | Observaciones |
  | `_creditos` | `smallint` | NOT NULL | 0 | **CRÍTICO PARA DW:** Créditos académicos (debe ser > 0 para cálculo de PPA) |
  | `id_materia_padre`| `integer` | NULL | `NULL` | **EN PASO 1 DEBE SER NULL** (Materia raíz sin prerrequisito) |
  | `descripcion` | `varchar` | NULL | - | Descripción sintética del contenido |
  | `fecha_creacion`| `timestamp`| NOT NULL| `now()` | Fecha de registro |
  | `materia_graduacion`| `char(2)`| NULL| `'NO'` | 'SI' si es Taller de Grado/Tesis |

---

### Nivel 3: Localidades y Malla Curricular con Prerrequisitos

#### 18. `public.lugar_localidad`
- **Propósito:** Ciudades, municipios y localidades de procedencia de los bachilleres.
- **Granularidad:** Un registro por localidad geográfica.
- **Clave Primaria:** `cod_loc` (`integer`, NOT NULL, PK).
- **Columnas (10 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `cod_loc` | `integer` | NOT NULL | `nextval('lugar_localidad_n_cod_loc_seq')` | PK |
  | `cod_prov` | `integer` | NOT NULL | - | FK -> `lugar_provincia(cod_prov)` |
  | `cod_dep` | `integer` | NULL | - | FK -> `lugar_departamento(cod_dep)` |
  | `cod_pais` | `integer` | NULL | - | FK -> `prs_pais_v2(id_pais)` |
  | `localidad` | `varchar(200)`| NULL | - | Nombre (ej. 'POTOSI', 'UYUNI', 'TUPIZA', 'BETANZOS') |
  | `cod_prov_original`| `integer`| NULL | - | Código histórico |
  | `cod_prov_2` | `integer` | NULL | - | Código secundario |
  | `cod_prov_3` | `integer` | NULL | - | Código terciario |
  | `_registrado` | `timestamp` | NOT NULL | `now()` | Auditoría de creación |
  | `_estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activo |

#### 19. `academico.pln_materias` (Paso 2: Asignaturas Avanzadas Ciclos 2 al 10)
- **Propósito:** Inserción de materias de ciclos superiores vinculadas recursivamente a sus prerrequisitos.
- **Granularidad:** Un registro por asignatura de ciclo 2 a 10.
- **Clave Primaria:** `id_materia` (`integer`, NOT NULL, PK).
- **Diferencia con Paso 1:** `id_materia_padre` apunta a una asignatura de ciclo inferior ya existente:
  ```sql
  FOREIGN KEY (id_materia_padre) REFERENCES academico.pln_materias(id_materia)
  ```
- **Valores Típicos:** `ciclo` $\in [2, 10]$, `_creditos` entre 3 y 6, `nota_minima` = 51.

---

### Nivel 4: Unidades Educativas y Asignación Docente

#### 20. `public.prs_colegios`
- **Propósito:** Unidades Educativas (Colegios) donde los estudiantes obtuvieron su bachillerato.
- **Granularidad:** Un registro por colegio formal con código SIE.
- **Clave Primaria:** `id_colegio` (`integer`, NOT NULL, PK).
- **Columnas (15 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_colegio` | `integer` | NOT NULL | - | PK unificada |
  | `id_colegio_original`| `smallint`| NOT NULL | - | Identificador de origen |
  | `colegio` | `varchar(65)` | NOT NULL | - | Nombre (ej. 'COLEGIO NACIONAL PICHINCHA') |
  | `tipo` | `char(1)` | NOT NULL | - | **TIPO:** 'F' (Fiscal), 'P' (Particular), 'C' (Convenio) |
  | `turno` | `char(1)` | NOT NULL | - | **TURNO:** 'M'/'D' (Mañana/Diurno), 'T'/'V' (Tarde/Vespertino), 'N' (Noche) |
  | `area` | `char(1)` | NOT NULL | - | **ÁREA:** 'U' (Urbana), 'R' (Rural), 'P' (Urbano Provincial) |
  | `cod_dep` | `smallint` | NOT NULL | - | Código de departamento (ej. 5 = Potosí) |
  | `cod_prov` | `smallint` | NOT NULL | - | Código de provincia |
  | `cod_loc` | `smallint` | NOT NULL | - | FK -> `lugar_localidad(cod_loc)` |
  | `cod_prov_2` | `integer` | NOT NULL | 0 | Homologación |
  | `id_pais` | `smallint` | NOT NULL | 30000 / 27 | Código de país |
  | `cod_ue` | `varchar(16)` | NULL | - | Código SIE del Ministerio de Educación |
  | `_estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activo |
  | `cod_prov_original`| `smallint`| NULL | - | Código de provincia histórico |
  | `fecha` | `timestamp` | NULL | `now()` | Fecha de registro |

#### 21. `academico.dct_asignaciones`
- **Propósito:** Asignación oficial de docentes a materias y paralelos por gestión y período.
- **Granularidad:** Un registro por grupo lectivo dictado por un docente en un período específico.
- **Clave Primaria:** `id_dct_asignaciones` (`integer`, NOT NULL, PK).
- **Restricción de Unicidad:** `UNIQUE (id_programa, id_materia, id_grupo, id_gestion, id_periodo)`.
- **Columnas Clave:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_dct_asignaciones`| `integer` | NOT NULL | `nextval('seq_id_dct_asignaciones')` | PK |
  | `id_docente` | `integer` | NOT NULL | - | FK -> `docentes(id_docente)` |
  | `id_programa` | `char(3)` | NOT NULL | - | FK -> `alm_programas(id_programa)` |
  | `id_materia` | `integer` | NOT NULL | - | FK -> `pln_materias(id_materia)` |
  | `id_grupo` | `smallint` | NOT NULL | 1 | Número de paralelo (1, 2, 3...) |
  | `id_gestion` | `smallint` | NOT NULL | - | Año de cursado (2000–2026) |
  | `id_periodo` | `smallint` | NOT NULL | - | Semestre lectivo (1 o 2; 3 anual) |
  | `tipo_calificacion`| `varchar(3)`| NULL | `'N'` | 'N' = Normal |
  | `se_elegido` | `varchar(1)` | NOT NULL | `'N'` | Indicador de designación |
  | `cupo_max` | `smallint` | NULL | 50 | Cupo máximo de alumnos por paralelo |
  | `_estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Asignación Activa |
  | `observacion` | `varchar` | NULL | - | Glosa de designación |

---

### Nivel 5: Identidad Ciudadana y Padrón Demográfico Maestro

#### 22. `public.uatf_datos`
- **Propósito:** Padrón civil y demográfico unificado de postulantes y estudiantes universitarios.
- **Granularidad:** Exactamente un registro por persona física (`id_ra`).
- **Clave Primaria:** `id_ra` (`varchar(10)`, NOT NULL, PK).
- **Restricción de Unicidad:** `UNIQUE (nro_dip)`, `UNIQUE (idfacebook)`.
- **Columnas (39 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_ra` | `varchar(10)` | NOT NULL | - | PK: Registro Académico único (ej. '1002345') |
  | `nro_dip` | `varchar(15)` | NULL | - | UNIQUE: Cédula de Identidad con complemento |
  | `paterno` | `varchar(64)` | NULL | - | Primer apellido (Mamani, Flores, etc.) |
  | `materno` | `varchar(64)` | NULL | - | Segundo apellido |
  | `nombres` | `varchar(128)`| NULL | - | Nombres de pila |
  | `id_sexo` | `varchar(1)` | NULL | - | 'M' (Masculino ~52%), 'F' (Femenino ~48%) |
  | `fec_nacimiento` | `date` | NULL | - | Fecha de nacimiento |
  | `nac_pais` | `integer` | NULL | - | FK -> `prs_pais_v2(id_pais)` (Bolivia = 27 / 30000) |
  | `id_dep` | `smallint` | NULL | - | FK -> `lugar_departamento(cod_dep)` (Potosí = 5) |
  | `id_prov_original`| `smallint` | NULL | - | Código de provincia |
  | `id_loc` | `smallint` | NULL | - | FK -> `lugar_localidad(cod_loc)` |
  | `direccion` | `varchar(60)` | NULL | - | Dirección domiciliaria en Potosí |
  | `telefono` | `varchar(15)` | NULL | - | Teléfono fijo |
  | `id_colegio` | `smallint` | NULL | - | FK -> `prs_colegios(id_colegio)` |
  | `egr_gestion` | `smallint` | NULL | - | Año de egreso de secundaria (ej. 2018–2024) |
  | `fec_registro` | `timestamptz` | NOT NULL | `now()` | Fecha y hora de registro civil |
  | `id_calificacion`| `varchar(1)` | NULL | - | FK -> `prs_calificacion(id_calificacion)`: '1' o '2' |
  | `tel_per` | `varchar` | NULL | - | Celular personal |
  | `tel_urg` | `varchar` | NULL | - | Teléfono de urgencia |
  | `tel_whatsapp` | `varchar` | NULL | - | WhatsApp de contacto |
  | `zona` | `varchar(50)` | NULL | - | Barrio de residencia (San Roque, Cantumarca, etc.) |
  | `estado_civil` | `smallint` | NOT NULL | 1 | FK -> `_bp_estados_civiles(id_estado_civil)`: 1 = Soltero |
  | `tdni` | `varchar` | NULL | `'CI'` | 'CI' (Cédula de Identidad), 'PAS' (Pasaporte) |
  | `dip_bach` | `varchar` | NULL | - | Folio del diploma de bachiller |
  | `idfacebook` | `varchar(64)` | NULL | - | UNIQUE: Enlace a cuenta social |
  | `obs` | `varchar` | NULL | - | Glosa de observaciones |
  | `email` | `varchar(50)` | NULL | - | Correo electrónico |
  | `id_prov_2` | `integer` | NULL | - | Homologación provincia |
  | `id_prov` | `integer` | NULL | - | Clave provincial |
  | `id_loc_3` | `integer` | NULL | - | Localidad de origen |
  | `_registrado` | `timestamp` | NOT NULL | `now()` | Timestamp de creación |
  | `tipo_sanguineo` | `smallint` | NOT NULL | 0 | Grupo sanguíneo (0 = No informado) |
  | `estado_civil_original`| `smallint`| NULL | - | Código histórico |
  | `_id_usuario` | `varchar(32)` | NOT NULL | `'root'` | Auditoría |
  | `_modificado` | `timestamp` | NOT NULL | `now()` | Timestamp de actualización |
  | `_tsidx` | `tsvector` | NULL | - | Vector de búsqueda full-text de nombres |
  | `nacionalidad` | `char(25)` | NULL | `'BOLIVIANO'` | Nacionalidad declarada |
  | `tipo_nro_dip` | `char(2)` | NULL | `'PT'` | Departamento de expedición ('PT', 'CH', 'OR', 'LP') |
  | `_fecha_registro`| `timestamp`| NOT NULL | `now()` | Auditoría de fecha |

---

### Nivel 6: Postulaciones de Admisión y Alumnos Matriculados

#### 23. `public.postulantes`
- **Propósito:** Intentos de admisión universitaria (examen de ingreso PSA, cursos preuniversitarios o ingreso directo).
- **Granularidad:** Exactamente un intento de postulación por fila (`id_alumno`).
- **Clave Primaria / Única:** `id_alumno` (`integer`, NOT NULL, UNIQUE / Secuencia serial propia de postulación).
- **Columnas (36 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_alumno` | `integer` | NOT NULL | `nextval('seq_postulantes_id')` | UNIQUE: Identificador interno de postulación |
  | `id_programa` | `char(3)` | NOT NULL | - | FK semántica -> `alm_programas(id_programa)` |
  | `id_ra` | `varchar(10)` | NOT NULL | - | FK semántica -> `uatf_datos(id_ra)` |
  | `fec_inscripcion`| `date` | NULL | `now()` | Fecha de registro de postulación |
  | `hora` | `timestamptz(0)`| NULL | `now()` | Hora de inscripción |
  | `id_plan` | `smallint` | NULL | - | Plan curricular ofertado |
  | `id_grado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activo |
  | `estado` | `char(1)` | NULL | `'P'` | **RESULTADO DE ADMISIÓN:** 'A' (Admitido/Aprobado $\ge 51$), 'P' (Reprobado $< 51$) |
  | `id_calificacion`| `char(1)` | NULL | - | Procedencia de colegio |
  | `promedio` | `numeric(6,2)`| NULL | - | Promedio final del examen (0.00 a 100.00) |
  | `nro_dip` | `varchar(15)` | NULL | - | Documento del postulante |
  | `examen` | `integer` | NULL | - | FK -> `prs_examen(id_examen)`: Modalidad de prueba |
  | `id_acceso` | `char(2)` | NULL | - | **CÓDIGO DE ADMISIÓN (DW):** 'PA', 'CN', 'EX', 'CP', 'TI', etc. |
  | `id_periodo` | `smallint` | NULL | 1 | 1 = Semestre I, 2 = Semestre II |
  | `id_gestion` | `smallint` | NULL | - | Año de admisión (2000–2026) |
  | `clave` | `varchar` | NULL | - | PIN de consulta de resultados |
  | `id_programa_a` | `char(3)` | NULL | - | Segunda opción de carrera |
  | `nota` | `integer` | NULL | 0 | Calificación cuantitativa entera (0 a 100) |
  | `obs` | `char(1)` | NULL | - | Flag interno |
  | `observacion` | `varchar(50)` | NULL | - | Glosa de admisión |
  | `anular_otra_carrera`| `char(2)`| NULL | NULL | Renuncia a carrera previa |
  | `guia` | `boolean` | NOT NULL | `false` | Entrega de prospecto universitario |
  | `_estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activo |
  | `fecha_aprobacion`| `date` | NULL | - | Fecha de publicación de listas oficiales |
  | `_ult_usuario` | `integer` | NOT NULL | 0 | Usuario auditor |
  | `_id_usuario` | `varchar(16)` | NOT NULL | - | Login del operador |
  | `_registrado` | `timestamp` | NOT NULL | `now()` | Timestamp de registro |
  | `_modificado` | `timestamp` | NOT NULL | `now()` | Timestamp de última modificación |
  | `antes_examen` | `smallint` | NOT NULL | 0 | Asistencia a curso preparatorio |
  | `tipo_nro_dip` | `varchar(2)` | NULL | - | Expedición de CI ('PT', 'CH') |
  | `nro_postulacion`| `integer` | NULL | - | Número de formulario de inscripción |
  | `sau_id_grupo` | `integer` | NULL | - | Aula/Laboratorio asignado para rendir examen |
  | `fec_calificacion`| `timestamp`| NULL | - | Fecha de corrección y captura de notas |

#### 24. `academico.alumnos`
- **Propósito:** Registro formal del estudiante matriculado en un programa universitario de la UATF.
- **Granularidad:** Un registro por estudiante en un programa específico (`id_alumno`).
- **Clave Primaria:** `id_alumno` (`integer`, NOT NULL, PK).
- **Columnas (24 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_alumno` | `integer` | NOT NULL | `nextval('alumnos_id_alumno_seq')` | PK: Identidad canónica del estudiante en el DW |
  | `id_programa` | `char(3)` | NOT NULL | - | FK -> `alm_programas(id_programa)` |
  | `id_ra` | `varchar(10)` | NULL | - | **CRÍTICO:** FK -> `uatf_datos(id_ra)` (100% de coincidencia requerida) |
  | `fec_inscripcion`| `date` | NOT NULL | `now()` | Fecha de primera matrícula formal |
  | `fec_egreso` | `date` | NULL | `now()` | Fecha de egreso (NULL para estudiantes activos/regulares) |
  | `id_plan` | `smallint` | NULL | - | Plan de estudios del estudiante (ej. 2018) |
  | `id_grado` | `char(1)` | NOT NULL | `'A'` | 'A' = Regular, 'B' = Bloqueado |
  | `id_tipo_aprobacion_bk`| `varchar`| NULL | - | Histórico |
  | `estado` | `char(1)` | NOT NULL | `'P'` | FK -> `alumnos_estados(estado)`: 'P' (Activo), 'A' (Profesional), 'T' (Titulado), 'B' (Bloqueado), 'X' (Anulado) |
  | `tipo_alumno` | `char(1)` | NOT NULL | `'A'` | 'B' = Boliviano (>98%), 'E' = Extranjero, 'N' = Nacionalizado |
  | `observacion` | `varchar` | NULL | - | Observación de matrícula |
  | `ult_usuario` | `varchar(64)` | NULL | - | Operador auditor |
  | `clave_cert` | `varchar` | NULL | - | Clave de certificado de notas |
  | `carrera` | `smallint` | NULL | 1 | Número correlativo de carrera cursada (1 = Primera, 2 = Simultánea) |
  | `reprogramar` | `char(1)` | NULL | `'N'` | 'S' / 'N' |
  | `id_tipo_aprobacion`| `smallint`| NULL | - | FK -> `prs_examen(id_examen)`: Modalidad por la que ingresó |
  | `f_anula` | `timestamp` | NULL | - | Fecha de anulación si aplica |
  | `_id_usuario_r`| `varchar` | NULL | - | Operador de registro |
  | `bloqueado` | `char(1)` | NULL | - | 'S' si tiene bloqueo administrativo/académico |
  | `_id_modalidad` | `integer` | NULL | - | Modalidad de ingreso |
  | `ssu` | `char(1)` | NOT NULL | `'S'` | Seguro Social Universitario ('S'/'N') |
  | `_fecha_registro`| `timestamp`| NULL | `now()` | Timestamp de alta en el sistema |
  | `id_postulante` | `integer` | NULL | 0 | Identificador del intento de postulación |
  | `id_mencion` | `integer` | NOT NULL | 0 | Mención académica de egreso (0 = General) |

---

### Nivel 7: Transacciones Académicas, Calificaciones y Titulación

#### 25. `academico.alm_programaciones`
- **Propósito:** Registro físico de la inscripción/programación a asignaturas en un grupo y período lectivo. Representa la **matrícula activa efectiva**.
- **Granularidad:** Un intento de cursado de asignatura en un grupo y período por estudiante.
- **Clave Primaria:** `id` (`integer`, NOT NULL, PK).
- **Restricción de Unicidad:** `UNIQUE (id_alumno, id_materia, id_gestion, id_periodo, id_grupo)`.
- **Columnas Clave:**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id` | `integer` | NOT NULL | `nextval('alm_programaciones_id_seq')` | PK |
  | `id_alumno` | `integer` | NOT NULL | - | FK -> `alumnos(id_alumno)` |
  | `id_materia` | `integer` | NOT NULL | - | FK -> `pln_materias(id_materia)` |
  | `id_gestion` | `smallint` | NOT NULL | - | Gestión académica (ej. 2024) |
  | `id_periodo` | `smallint` | NOT NULL | - | FK -> `alm_periodos(id_periodo)` |
  | `id_grupo` | `smallint` | NULL | 1 | Número de paralelo |
  | `fecha` | `timestamp` | NOT NULL | `now()` | Fecha y hora de programación de materias |
  | `ult_usuario` | `varchar(22)` | NOT NULL | - | Auditoría |
  | `estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activa |
  | `pparcial` | `smallint` | NULL | 0 | Calificación 1er parcial |
  | `sparcial` | `smallint` | NULL | 0 | Calificación 2do parcial |
  | `tparcial` | `smallint` | NULL | 0 | Calificación 3er parcial |
  | `cparcial` | `smallint` | NULL | 0 | Calificación 4to parcial / Examen final |
  | `nota` | `smallint` | NULL | 0 | Calificación final acumulada |
  | `nota_2da` | `smallint` | NULL | 0 | Examen de segundo turno |
  | `nota_ex_mesa` | `smallint` | NULL | 0 | Examen de mesa |
  | `_estado` | `varchar` | NOT NULL | `'REGISTRADO'` | 'REGISTRADO', 'ANULADO' |
  | `tipo_programacion`| `varchar`| NULL | `'NORMAL'` | 'NORMAL', 'ESPECIAL', 'PARALELA' |

#### 26. `academico.notas_planilla`
- **Propósito:** Tabla hiper-transaccional de cursado cerrado y calificaciones finales. Es la **fuente exclusiva de `dw.fact_cursado`**.
- **Granularidad:** Un cursado evaluado por estudiante, asignatura, gestión, período y grupo.
- **Clave Primaria:** `id_matricula` (`integer`, NOT NULL, PK / UNIQUE).
- **Restricción de Unicidad:** `UNIQUE (id_gestion, id_periodo, id_alumno, id_materia, grupo, _unique)`.
- **Columnas (31 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id_matricula` | `integer` | NOT NULL | `nextval('notas_planilla_id_matricula_seq')` | PK / UNIQUE |
  | `id_gestion` | `smallint` | NOT NULL | - | Año lectivo de cursado |
  | `id_periodo` | `smallint` | NOT NULL | - | Término académico (1 o 2; 3 anual; 0 verano) |
  | `id_alumno` | `integer` | NOT NULL | - | FK -> `alumnos(id_alumno)` |
  | `id_materia` | `smallint` | NOT NULL | - | **DISCREPANCIA:** En notas es `smallint`, en materias es `integer`. ID $\le 32767$ |
  | `grupo` | `smallint` | NULL | 1 | Número de paralelo cursado |
  | `nota` | `numeric(5,2)`| NULL | 0.00 | **CALIFICACIÓN FINAL REGULAR** (0.00 a 100.00) |
  | `ult_usuario` | `varchar` | NOT NULL | - | Login auditor de cierre de acta |
  | `estado` | `char(1)` | NOT NULL | - | **CONDICIÓN DE CURSADO:** 'A' (Aprobado), 'R' (Reprobado), 'H' (Homologado), 'C' (Convalidado), 'S' (Compensado), 'D' (Dictamen), 'X'/'U'/'Z'/'T' (Abandono) |
  | `observacion` | `varchar` | NULL | - | Glosa de cierre (ej. 'DW_TEST_SEED_V2:normal') |
  | `nota_2da` | `numeric` | NULL | 0 | Calificación de segundo turno |
  | `nota_ex_mesa` | `numeric` | NULL | 0 | Calificación de examen de mesa |
  | `pparcial` | `numeric` | NULL | 0 | Primer examen parcial (ponderado 30%) |
  | `sparcial` | `numeric` | NULL | 0 | Segundo examen parcial (ponderado 30%) |
  | `tparcial` | `numeric` | NULL | 0 | Tercer examen parcial (ponderado 20%) |
  | `cparcial` | `numeric` | NULL | 0 | Cuarto examen parcial / final (ponderado 20%) |
  | `promparcial` | `numeric` | NULL | 0 | Promedio de parciales |
  | `pract` | `numeric` | NULL | 0 | Evaluación práctica |
  | `prompract` | `numeric` | NULL | 0 | Promedio de prácticas |
  | `lab` | `numeric` | NULL | 0 | Evaluación de laboratorio |
  | `promlab` | `numeric` | NULL | 0 | Promedio de laboratorio |
  | `notapres` | `numeric` | NULL | 0 | Nota de presentación |
  | `exfinal` | `numeric` | NULL | 0 | Examen final regular |
  | `promexfinal` | `numeric` | NULL | 0 | Promedio final computado |
  | `tipo` | `varchar(1)` | NULL | `'N'` | 'N' = Normal, '2' = Segundo Turno, 'M' = Mesa |
  | `dictamen` | `varchar` | NULL | - | Código de resolución |
  | `_fecha_creacion`| `timestamp`| NULL | `now()` | Fecha y hora de consolidación de acta |
  | `id_materia_cnv` | `integer[]` | NULL | - | IDs de materias convalidadas |
  | `_unique` | `integer` | NOT NULL | 1 | Discriminador de rectificaciones o reintentos en el mismo período |
  | `__estado` | `varchar` | NOT NULL | `'A'` | 'A' (Automático), 'R' (Reposición), 'S' (Segundos Turnos), 'C' (Convalidaciones) |
  | `__obsv` | `varchar` | NULL | `''` | Observación complementaria |

#### 27. `actas_graduacion.graduados`
- **Propósito:** Registro oficial de estudiantes graduados/titulados y modalidad de titulación.
- **Granularidad:** Un registro por evento de titulación universitaria.
- **Clave Primaria:** `id` (`integer`, NOT NULL, PK).
- **Columnas (14 confirmadas en PostgreSQL 14.2):**
  | Columna | Tipo de Dato | Nulabilidad | Default | Restricciones / FKs |
  |---|---|---|---|---|
  | `id` | `integer` | NOT NULL | `nextval('graduados_id_seq')` | PK |
  | `id_alumno` | `integer` | NULL | - | FK -> `alumnos(id_alumno)` |
  | `id_programa` | `char(3)` | NULL | - | FK -> `alm_programas(id_programa)` |
  | `titulo` | `text` | NULL | - | Título del proyecto de grado o tesis |
  | `id_modalidad` | `integer` | NULL | - | 1 = Tesis, 2 = Proyecto de Grado, 3 = Examen de Grado, 4 = Excelencia, 5 = Trabajo Dirigido |
  | `fecha_graduacion`| `date` | NULL | - | Fecha de defensa y colación |
  | `id_gestion` | `smallint` | NULL | - | Año oficial de titulación |
  | `nota_graduacion`| `numeric(10,2)`| NULL| - | Calificación de defensa (ej. 85.00 a 100.00) |
  | `id_nota_literal`| `integer` | NULL | - | Código de mención de honor |
  | `_registrado` | `timestamp` | NOT NULL | `now()` | Auditoría de creación |
  | `_modificado` | `timestamp` | NOT NULL | `now()` | Auditoría de modificación |
  | `_estado` | `char(1)` | NOT NULL | `'A'` | 'A' = Activo |
  | `_id_usuario` | `varchar(32)` | NULL | - | Operador auditor (en DDL era `char(32)`) |
  | `nro_dip` | `char(32)` | NULL | - | Cédula de identidad del graduado |

---

## 5. Schema Mapping Manifesto (Directrices de Transformación para Seed)

Siguiendo el estándar `schema-mapping`, el generador sintético debe implementar las siguientes transformaciones universales de higiene de datos:

### 5.1. Estandarización de Nulos y Cadenas Vacías
- Las cadenas vacías (`""`), cadenas literales `"NULL"`, `"None"` o `"N/A"` deben insertarse como `NULL` verdadero de base de datos en columnas anulables.
- Columnas con restricción `NOT NULL` deben poblarse con valores no nulos legítimos o sus valores por defecto declarados (ej. `_obs = ''`, `ssu = 'S'`).

### 5.2. Casing y Normalización de Códigos
- Todos los códigos trilaterales de programas (`id_programa`) deben estar estrictamente en mayúsculas y tener longitud exacta de 3 caracteres (ej. `'SIS'`, `'CIV'`, `'MED'`, `'ADM'`).
- Las siglas de asignaturas (`sigla`) deben respetar el formato de 7 caracteres: `'SIS-111'`, `'MAT-101'`.
- Los códigos de departamento en CI (`tipo_nro_dip`) deben estar normalizados a 2 caracteres en mayúsculas: `'PT'`, `'CH'`, `'OR'`, `'LP'`, `'CB'`, `'SC'`, `'TJ'`, `'BE'`, `'PA'`.

### 5.3. Consistencia Temporal y Progresión de Cohortes
- Para cada cohorte longitudinal generada ($2018 \le \text{gestion} \le 2026$):
  $$\text{fec\_nacimiento} < \text{fec\_registro\_colegio} \le \text{fec\_postulacion} \le \text{fec\_inscripcion\_alumno} \le \text{fec\_cursado} < \text{fec\_graduacion}$$
- Un estudiante debe tener al menos 17 años cumplidos al momento de postular a la universidad.

### 5.4. Defensas de Tipos Numéricos en Materias
- Debido a que `academico.notas_planilla.id_materia` está tipificado como `smallint` (rango máximo: 32,767), **todos los identificadores generados en `academico.pln_materias.id_materia` deben encontrarse en el rango $[1000, 32000]$**. Superar el valor 32,767 provocará desbordamiento (`integer out of range for smallint`) al registrar calificaciones en notas de planilla.

---

## 6. Verificación de Conformidad del Esquema

Para validar independientemente este catálogo contra una instancia de PostgreSQL:
1. **Comprobar ausencia de columnas fantasma:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'postulantes' 
     AND column_name IN ('estado_postulacion', 'id_recaudaciones', 'nro_impresiones');
   -- Resultado esperado: 0 filas.
   ```
2. **Validar orden topológico sin violaciones de clave foránea:**
   Ejecutar la inserción secuencial de los Niveles 0 al 7 asegurando `SET session_replication_role = 'origin'`.

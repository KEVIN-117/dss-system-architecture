# Master Seed Specification & Developer Guide: Synthetic Data Generator (DATA-001 / Issue #206)
**Documento Maestro y Guía Definitiva de Implementación para el Generador Sintético de la UATF**  
**Proyecto:** UATF Academic Decision Support System (DSS-DW-ML)  
**Estándares:** Semantic Schema Mapping Manifesto (`schema-mapping` skill v1) & Metodología HEFESTO v2.0  
**Stack de Implementación:** Node.js 20+ LTS, TypeScript 5+, `@faker-js/faker` v10 (`@faker-js/faker/locale/es`)  
**Base de Datos Destino:** PostgreSQL 14.2 (Host `10.10.166.120`, Base de Datos `jachasun`)  
**Autor:** Worker M3 (Master Seed Specification Synthesizer)  
**Fecha de Consolidación:** 2026-10-29  
**Estado:** Aprobado para Construcción (Normativo / Contrato de Ingeniería)  

---

## 1. Resumen Ejecutivo y Alcance del Proyecto

### 1.1. Contexto y Justificación (Issue #206 / DATA-001)
Para el desarrollo, validación y certificación de la plataforma analítica institucional y los modelos predictivos de deserción y retención estudiantil de la **Universidad Autónoma Tomás Frías (UATF)** de Potosí, Bolivia, se requiere poblar el entorno de base de datos transaccional simulado (OLTP en el esquema `jachasun` sobre **PostgreSQL 14.2**) con cohortes longitudinales completas que abarquen el período lectivo **2018 a 2026**.

En fases tempranas de prototipado, los generadores sintéticos desarrollados en Python (`generate_mock_data.py`, `generate_fake_data.py`) adolecían de deficiencias estructurales críticas:
1. **Distorsión Demográfica y Onomástica Severa:** Utilizaban diccionarios genéricos de la península ibérica (`es_ES`), asignando a estudiantes andinos nombres y apellidos ajenos como *Llopis*, *Carbó* o *Pujol*, y domicilios en ciudades extranjeras, invalidando las pruebas de segmentación territorial y pertenencia comunitaria.
2. **Reducción Arbitraria del Modelo Académico:** Modelaban únicamente 5 facultades y 10 carreras genéricas, ignorando la realidad de las 13 facultades, 86 programas de pregrado (tanto de régimen semestral como anual) y las 7 sub-sedes provinciales de la UATF.
3. **Violación de Contratos de Ingesta ETL (Apache Hop):** Omitían columnas obligatorias como `_tipo_academico = 'CAR'` y configuraban `activo = 'SI'` (en lugar de `'A'`), provocando que los pipelines de extracción descartaran el 100% de los registros académicos.
4. **Crashes por Columnas Fantasma:** Hacían referencia a 24 columnas obsoletas o inexistentes heredadas de respaldos DDL antiguos (PostgreSQL 9.3), disparando excepciones de ejecución (`column does not exist`).
5. **División por Cero en Métricas Analíticas:** Asignaban créditos nulos (`_creditos = 0`), colapsando el cálculo del Promedio Ponderado Acumulado (PPA) en el Data Warehouse.

### 1.2. Límites del Sistema y Consumidores Downstream
El generador sintético TypeScript no opera de manera aislada; actúa como el **proveedor raíz de datos** para una arquitectura de decisión multicapa:
```
┌────────────────────────────────────────────────────────────────────────┐
│                        SIMULATED OLTP (PostgreSQL 14.2)               │
│                            Database: jachasun                          │
│                                                                        │
│   [public]                      [academico]         [actas_graduacion] │
│   - uatf_datos (Demografía)     - alumnos           - graduados        │
│   - postulantes (Admisiones)    - alm_programas                        │
│   - lugar_localidad             - pln_materias                         │
│   - prs_colegios                - notas_planilla                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ (Apache Hop ETL Pipelines)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA WAREHOUSE (HEFESTO v2.0)                   │
│                            Database: dw_uatf                           │
│                                                                        │
│   - dim_estudiante (SCD Tipo 2)          - fact_cursado                │
│   - dim_programa_academico               - fact_retencion_desercion    │
│   - dim_periodo_academico                - fact_admision               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ (Feature Extraction / ML Pipelines)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   MACHINE LEARNING ENGINE (Python / Scikit)            │
│                       Dataset: prepared-dataset-v1                     │
│                                                                        │
│   - Modelo de Predicción de Deserción Temprana (Semestres 1 y 2)       │
│   - Detección de Abandono Crónico (Regla DSA: < 2 evaluaciones)        │
│   - Análisis de Riesgo Académico por Materias Filtro (Cálculo, Física) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inventario de Catálogos y Documentos Normativos

El generador debe consumir exclusivamente las especificaciones consolidadas y los catálogos JSON estructurados en `docs/seed-data/`. La siguiente tabla detalla la correspondencia entre la documentación técnica, los artefactos de datos y las tablas físicas del esquema `jachasun`:

| Identificador | Archivo / Artefacto | Rol y Propósito en el Generador | Tablas Físicas Ancla en `jachasun` | Registros / Volumen Base | Atributos Clave / Esquema |
|:---|:---|:---|:---|:---:|:---|
| **DOC-01** | `01_oltp_schema_and_topological_mapping.md` | Especificación técnica del DDL PostgreSQL 14.2, tipos de datos, constraints y grafo de 8 niveles. | 26 tablas físicas transaccionales y maestras | N/A (Norma DDL) | Tipos PG 14.2, PKs, FKs, defaults, restricciones de unicidad y chequeo. |
| **DOC-02** | `02_academic_structure_uatf.md` | Catálogo institucional de facultades, programas, planes, mallas y cadenas de prerrequisitos. | `academico.alm_programas_facultades`, `alm_programas`, `pln_materias`, `planes` | 13 facultades, 86 programas | `id_programa`, `id_facultad`, `id_sede`, `regimen`, `nivel`, `sigla`, `_creditos`. |
| **DOC-03** | `03_geographic_demographic_schools_catalog.md` | Especificación de geografía nacional, 16 provincias de Potosí, colegios SIE y frecuencias onomásticas. | `public.lugar_departamento`, `lugar_provincia`, `lugar_localidad`, `prs_colegios`, `uatf_datos` | 9 deptos, 16 provs, 4,471 locs, 5,235 colegios | `cod_dep`, `cod_prov`, `cod_loc`, `cod_ue`, `nro_dip`, `tipo_nro_dip`, `id_ra`. |
| **DOC-04** | `04_system_lookups_and_simulation_rules.md` | Diccionario de dominios de lookup, 15 modalidades de admisión, fórmulas 30/30/20/20 y regla DSA. | `public.postulantes`, `academico.alumnos`, `alm_programaciones`, `notas_planilla` | 15 modalidades, 9 dominios | `id_acceso`, `pparcial`, `sparcial`, `tparcial`, `cparcial`, `nota`, `nota_2da`, `estado`. |
| **JSON-01** | `catalogs/lookup_reference_codes.json` | Códigos de tablas maestras, 15 modalidades de admisión, reglas de evaluación y contratos DW/Hop. | Tablas independientes de Nivel 0 y contratos analíticos | 9 tablas de lookup, 15 modalidades de ingreso | `admission_modalities`, `system_lookups`, `grading_simulation_rules`, `downstream_dw_and_ml_rules`. |
| **JSON-02** | `catalogs/faculties_and_careers.json` | Estructura orgánica completa de las 13 facultades, 8 sedes territoriales y 86 programas académicos. | `academico.alm_programas_facultades`, `sedes`, `carreras_tipos`, `alm_programas` | 13 facultades, 8 sedes, 6 áreas CEUB, 86 carreras | `id_programa`, `name`, `id_facultad_numeric`, `id_sede`, `regime`, `duration_years`, `degree_level`. |
| **JSON-03** | `catalogs/study_plans_and_courses.json` | Mallas curriculares detalladas de 8 carreras ancla y reglas procedurales para las 78 carreras restantes. | `academico.pln_materias`, `academico.planes` | 8 mallas completas (~320 materias), reglas para 78 programas | `sigla`, `name`, `level`, `hours_theory`, `hours_practice`, `credits`, `prerequisites`. |
| **JSON-04** | `catalogs/geographic_bolivia_potosi.json` | Jerarquía territorial de los 9 departamentos, 16 provincias de Potosí, 4,471 localidades y 28 barrios urbanos. | `public.lugar_departamento`, `lugar_provincia`, `lugar_localidad` | 9 departamentos, 16 provincias, 2,006 localidades de Potosí, 28 barrios | `cod_dep`, `cod_prov`, `cod_loc`, `potosi_provinces`, `urban_potosi`. |
| **JSON-05** | `catalogs/demographic_names_surnames.json` | Distribución empírica del Top 100 de apellidos bolivianos (Quechua/Aymara/Castellano), nombres y parámetros DIP. | `public.uatf_datos`, `academico.alumnos` | Top 100 apellidos ponderados, 50+ nombres simples y compuestos | `surnames.empirical_top_100`, `first_names`, `document_identification`, `demographic_parameters`. |
| **JSON-06** | `catalogs/schools_catalog.json` | Unidades educativas con códigos SIE, dependencia (Fiscal, Privada, Convenio), turnos y colegios emblemáticos. | `public.prs_colegios` | 5,235 colegios nacionales, 15 emblemáticos de Potosí, 150 colegios muestra | `cod_ue`, `name`, `type`, `shift`, `area`, `iconic_potosi_schools`, `empirical_distributions`. |

---

## 3. Arquitectura del Generador y Flujo de Ejecución End-to-End

El script generador (`seed_generator.ts`) debe estructurarse como un pipeline secuencial de 5 fases, garantizando el aislamiento de etapas y la integridad referencial en todo momento:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FASE 1: INICIALIZACIÓN Y CONFIGURACIÓN               │
│ - Validación de variables de entorno (DATABASE_URL, SEED, COHORT_SIZE) │
│ - Fijación determinista de semilla Faker (`faker.seed(12345)`)         │
│ - Carga en memoria de los 6 catálogos JSON en `catalogs/`              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FASE 2: INSERCIÓN DE JERARQUÍAS ESTÁTICAS            │
│                 (Topological Levels 0 al 4: Tablas Maestras)           │
│ - Nivel 0: Catálogos independientes (Países, Estados Civiles, etc.)    │
│ - Nivel 1: Departamentos, Períodos (reflexivo) y Programas Académicos   │
│ - Nivel 2: Provincias, Docentes y Materias Ciclo 1 (id_padre = NULL)   │
│ - Nivel 3: Localidades y Materias Ciclos 2-10 (enlace a id_padre)      │
│ - Nivel 4: Colegios (SIE) y Asignaciones Docentes                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           FASE 3: BUCLE LONGITUDINAL DE COHORTES (2018 a 2026)          │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Para cada Gestión Y en [2018..2026]:                               │ │
│ │  1. Generar Postulantes de Admisión (15 modalidades, cuotas y test)│ │
│ │  2. Filtrar Admitidos (estado='A') y crear uatf_datos + alumnos    │ │
│ │  3. Para cada Período P (1 y 2 en Semestral, 3 en Anual):          │ │
│ │     a. Matricular materias según Malla y Prerrequisitos (DAG)      │ │
│ │     b. Simular Evaluaciones Parciales (Fórmula 30/30/20/20)        │ │
│ │     c. Evaluar Regla DSA: si parciales < 2 => ABANDONO ('X')       │ │
│ │     d. Computar Calificación Final, 2do Turno y Examen de Mesa     │ │
│ │     e. Persistir en `alm_programaciones` y `notas_planilla`        │ │
│ │  4. Actualizar Estado de Alumnos (P=Regular, X=Desertor, A=Egreso) │ │
│ │  5. Titular Graduados en `actas_graduacion.graduados`              │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             FASE 4: AUDITORÍA DE INTEGRIDAD Y REGLAS DE NEGOCIO        │
│ - Verificación de ausencia de las 24 columnas fantasma                 │
│ - Comprobación de integridad referencial 100% uatf_datos <-> alumnos   │
│ - Verificación de cumplimiento de filtros Apache Hop (_tipo='CAR')     │
│ - Confirmación de créditos > 0 y consistencia de PPA                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               FASE 5: BULK INSERT / EMISIÓN SQL PARAMETRIZADA          │
│ - Inserción en bloques con transacciones (`BEGIN ... COMMIT`)          │
│ - Opcional: Generación de dump SQL determinista `seed_uatf_repro.sql`  │
│ - Emisión de resumen métrico de filas insertadas por tabla             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Plano Topológico de Inserción en 8 Niveles (Zero-FK Violations)

Para garantizar la inserción determinista de 0 a 100% sin provocar errores `FOREIGN KEY constraint violation` y **sin desactivar restricciones ni requerir privilegios de superusuario (`SET session_replication_role = 'replica'`)**, las tablas deben poblarse en estricto orden de dependencias acíclicas en 8 niveles:

```
========================================================================================
NIVEL 0: CATÁLOGOS INDEPENDIENTES RAÍZ (Tablas sin dependencias foráneas salientes)
  [1]  public.prs_pais_v2                      (1 registro: '01' Bolivia)
  [2]  public._bp_estados_civiles              (4 registros: 1-Soltero, 2-Casado, etc.)
  [3]  public.prs_calificacion                 (4 registros: '1'-Fiscal, '2'-Particular, etc.)
  [4]  public.prs_examen                       (15 registros: 1-PSA, 2-CPU, 5-ID, etc.)
  [5]  academico.alm_programas_facultades      (13 registros: 1-Artes a 13-Vicerrectorado)
  [6]  academico.carreras_tipos                (2 registros: 'C'-Carrera, 'P'-Programa)
  [7]  academico.sedes                         (8 registros: '1'-Potosí a '8'-San Cristóbal)
  [8]  academico.alumnos_estados               (6 registros: 'P'-Regular, 'B'-Bloqueado, etc.)
  [9]  academico.periodos                      (8 registros: 0-Verano a 7-Mesa 2)
  [10] academico.docentes_tiempo               (3 registros: 'TC'-Tiempo Completo, etc.)
========================================================================================
                                       │
                                       ▼
========================================================================================
NIVEL 1: JERARQUÍA GEOGRÁFICA BASE Y PROGRAMAS ACADÉMICOS
  [11] public.lugar_departamento               (9 registros: FK -> prs_pais_v2)
  [12] academico.alm_periodos                  (8 registros: Auto-enlace id_periodo_relacion)
  [13] academico.alm_programas                 (86 registros: FKs -> facultades, tipos, sedes)
========================================================================================
                                       │
                                       ▼
========================================================================================
NIVEL 2: PROVINCIAS, PROGRAMAS DESNORMALIZADOS Y ASIGNATURAS BASE (CICLO 1)
  [14] public.lugar_provincia                  (16 registros de Potosí + provs capitales)
  [15] public.fac_programas                    (86 registros: catálogo complementario con tipo_c)
  [16] academico.docentes                      (150 a 500 docentes por sede/programa)
  [17] academico.pln_materias (FASE 1)         (Materias de Nivel 1 con id_materia_padre = NULL)
========================================================================================
                                       │
                                       ▼
========================================================================================
NIVEL 3: LOCALIDADES Y MALLA CURRICULAR AVANZADA CON PRERREQUISITOS
  [18] public.lugar_localidad                  (4,471 localidades: FKs -> prov, depto, pais)
  [19] academico.pln_materias (FASE 2)         (Materias Niveles 2 al 10 con FK id_materia_padre)
========================================================================================
                                       │
                                       ▼
========================================================================================
NIVEL 4: UNIDADES EDUCATIVAS Y ASIGNACIÓN DE CARGA DOCENTE
  [20] public.prs_colegios                     (488 colegios de Potosí + muestra nacional)
  [21] academico.dct_asignaciones              (Asignación docente-materia por gestión/período)
========================================================================================
                                       │
                                       ▼
========================================================================================
NIVEL 5: PADRÓN DEMOGRÁFICO MAESTRO E IDENTIDAD CIUDADANA
  [22] public.uatf_datos                       (Población de personas: estudiantes y postulantes)
========================================================================================
                                       │
                                       ▼
========================================================================================
NIVEL 6: POSTULACIONES DE ADMISIÓN Y EXPEDIENTE ESTUDIANTIL
  [23] public.postulantes                      (Postulantes con 15 modalidades y resultado)
  [24] academico.alumnos                       (Estudiantes admitidos y matriculados oficialmente)
========================================================================================
                                       │
                                       ▼
========================================================================================
NIVEL 7: TRANSACCIONES ACADÉMICAS, CALIFICACIONES Y TITULACIÓN
  [25] academico.alm_programaciones            (Inscripciones a materias por gestión y período)
  [26] academico.notas_planilla                (Actas cerradas de cursado: evaluaciones y estados)
  [27] actas_graduacion.graduados              (Estudiantes titulados por modalidad de grado)
========================================================================================
```

### 4.1. Recomendaciones de Volumen de Datos por Escala de Cohorte
Para adaptarse a diversos entornos de ejecución (pruebas unitarias rápidas, integración continua, staging y benchmarking de estrés del DW), se definen tres perfiles volumétricos:

| Parámetro / Entidad | Cohorte Pequeña (CI / Fast Test) | Cohorte Mediana (Staging / Dev) | Cohorte Grande (Producción / DW Full) |
|:---|:---:|:---:|:---:|
| **Rango de Gestiones** | 2024 – 2025 (2 años) | 2022 – 2026 (5 años) | 2018 – 2026 (9 años completos) |
| **Carreras Simuladas** | 8 carreras ancla | 25 carreras principales | 86 carreras (100% oferta UATF) |
| **Docentes (`docentes`)** | 80 | 350 | 1,200 |
| **Postulantes (`postulantes`)** | 1,200 | 15,000 | 65,000 |
| **Personas (`uatf_datos`)** | 1,000 | 12,000 | 50,000 |
| **Estudiantes (`alumnos`)** | 600 | 7,500 | 32,000 |
| **Inscripciones (`alm_programaciones`)** | 6,000 | 120,000 | 750,000 |
| **Calificaciones (`notas_planilla`)** | 6,000 | 120,000 | 750,000 |
| **Graduados (`graduados`)** | 50 | 1,200 | 6,500 |
| **Tiempo Estimado de Generación** | < 5 segundos | ~45 segundos | ~3.5 minutos |

### 4.2. Resolución de Dependencias Circulares y Auto-Referencias

1. **Auto-referencia en Asignaturas (`academico.pln_materias.id_materia_padre`):**
   - *Problema:* Las asignaturas de semestres superiores poseen clave foránea `id_materia_padre REFERENCES pln_materias(id_materia)`. Si se insertan en un solo bloque, fallará la validación de integridad foránea.
   - *Solución:* Inserción en 2 fases:
     - **Fase 1 (Nivel 2):** Insertar la totalidad de asignaturas de **Nivel 1 (Ciclo inicial)** asignando explícitamente `id_materia_padre = NULL`.
     - **Fase 2 (Nivel 3):** Insertar en cascada progresiva las asignaturas de los **Niveles 2 al 10**, vinculando `id_materia_padre` con los IDs de las materias ya registradas en ciclos anteriores.
2. **Auto-referencia en Períodos (`academico.alm_periodos.id_periodo_relacion`):**
   - *Problema:* La columna `id_periodo_relacion` es `NOT NULL` y apunta a `alm_periodos(id_periodo)`.
   - *Solución:* Para la población base del catálogo (códigos 0 al 7), insertar filas asignando reflexivamente `id_periodo_relacion = id_periodo`.
3. **Desacoplamiento Estructural Postulante ↔ Alumno:**
   - En `public.postulantes`, la columna `id_alumno` es un entero secuencial interno de postulación (`UNIQUE (id_alumno)`) y **no tiene clave foránea física** hacia `academico.alumnos.id_alumno`.
   - La correspondencia lógica y de negocio se establece mediante el par natural `(id_ra, id_programa)`. Un postulante reprobado (`estado = 'P'`) no se inserta en `alumnos`, mientras que el postulante admitido (`estado = 'A'`) genera su registro en `alumnos` heredando el mismo `id_ra`.

---

## 5. Guía de Integración de Catálogos con TypeScript y Faker.js v10

Para garantizar la reproducibilidad científica, modularidad y ausencia de alucinaciones en los datos, el generador TypeScript debe implementar las siguientes utilidades de extracción y muestreo determinista.

### 5.1. Inicialización y Muestreo Ponderado (Discrete CDF)
El muestreo de distribuciones probabilísticas (apellidos, procedencia geográfica, modalidades) debe implementarse mediante la función de distribución acumulada (CDF) discreta:

```typescript
import { fakerES as faker } from '@faker-js/faker';
import fs from 'node:fs';
import path from 'node:path';

// 1. Fijar semilla determinista
export function initializeFaker(seedValue = 12345): void {
  faker.seed(seedValue);
}

// 2. Cargador tipado de catálogos JSON
export function loadCatalog<T>(catalogFileName: string): T {
  const filePath = path.resolve(__dirname, '../catalogs', catalogFileName);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(rawData) as T;
}

// 3. Algoritmo genérico de selección ponderada (Discrete CDF)
export interface WeightedItem<T> {
  item: T;
  weight: number;
}

export function sampleWeighted<T>(items: WeightedItem<T>[]): T {
  if (!items || items.length === 0) {
    throw new Error('sampleWeighted error: items array cannot be empty');
  }
  if (items.length === 1) return items[0].item;
  const totalWeight = items.reduce((sum, current) => sum + current.weight, 0);
  if (totalWeight <= 0) return items[0].item;
  const randomThreshold = faker.number.float({ min: 0, max: totalWeight });
  
  let accumulated = 0;
  for (const entry of items) {
    accumulated += entry.weight;
    if (randomThreshold <= accumulated) {
      return entry.item;
    }
  }
  return items[items.length - 1].item;
}
```

### 5.2. Generador Demográfico Potosino (Nombres, Apellidos y C.I.)
Utiliza `demographic_names_surnames.json` para reflejar la distribución onomástica real de la UATF (38.5% raigambre Quechua/Aymara y 61.5% Castellana):

```typescript
interface SurnameEntry {
  surname: string;
  count: number;
  frequency_percentage: number;
  origin: string;
}

interface TopNameEntry {
  name: string;
  count: number;
  is_composite: boolean;
  weight: number;
}

interface DemographicCatalog {
  surnames: { empirical_top_100: SurnameEntry[] };
  first_names: {
    male: { top_names: TopNameEntry[]; composite_rate: number; single_rate: number };
    female: { top_names: TopNameEntry[]; composite_rate: number; single_rate: number };
  };
  document_identification: {
    ci_dip: {
      min_number: number;
      max_number: number;
      extension_distribution: Record<string, number>;
      complement_probability: number;
    };
    id_ra: { prefix: string; format: string; regex: string };
  };
}

export class DemographicGenerator {
  private catalog: DemographicCatalog;
  private surnameWeights: WeightedItem<string>[];
  private extensionWeights: WeightedItem<string>[];

  constructor(catalog: DemographicCatalog) {
    this.catalog = catalog;
    this.surnameWeights = this.catalog.surnames.empirical_top_100.map((s) => ({
      item: s.surname,
      weight: s.frequency_percentage,
    }));
    this.extensionWeights = Object.entries(
      this.catalog.document_identification.ci_dip.extension_distribution
    ).map(([ext, weight]) => ({ item: ext, weight }));
  }

  public generatePerson(gender: 'M' | 'F') {
    // 1. Nombres según tasa de compuestos
    const config = gender === 'M' ? this.catalog.first_names.male : this.catalog.first_names.female;
    const isComposite = faker.number.float({ min: 0, max: 1 }) < config.composite_rate;
    const pool = config.top_names.filter((n) => n.is_composite === isComposite).map((n) => n.name);
    const nombres = faker.helpers.arrayElement(pool);

    // 2. Apellidos paterno y materno ponderados
    // Muestreo independiente que preserva la tasa empírica natural de homonimia
    // paterno/materno (~1.07% en egresados UATF; sin bucle de exclusión artificial).
    const paterno = sampleWeighted(this.surnameWeights);
    const materno = sampleWeighted(this.surnameWeights);

    // 3. Documento de Identidad (DIP) y Extensión SEGIP
    // NOTA DE ESQUEMA: La tabla PostgreSQL public.uatf_datos contiene únicamente
    // la columna 'nro_dip varchar(15)' (no existe columna separada de complemento).
    // Cuando existe complemento por homonimia SEGIP, se formatea directamente como ${baseDip}-${complemento}.
    const ciConfig = this.catalog.document_identification.ci_dip;
    const baseDip = faker.number.int({ min: ciConfig.min_number, max: ciConfig.max_number });
    const tipoNroDip = sampleWeighted(this.extensionWeights); // 70% 'PT'
    const hasComplement = faker.number.float({ min: 0, max: 1 }) < ciConfig.complement_probability;
    const nroDip = hasComplement
      ? `${baseDip}-${faker.number.int({ min: 1, max: 9 })}A`
      : baseDip.toString();

    return {
      nombres,
      paterno,
      materno,
      nro_dip: nroDip,
      tipo_nro_dip: tipoNroDip,
      id_sexo: gender,
    };
  }

  public generateStudentIdRa(sequentialIndex: number): string {
    return `RA-${sequentialIndex.toString().padStart(6, '0')}`;
  }
}
```

### 5.3. Generador de Domicilios Urbanos de Potosí
Utiliza `geographic_bolivia_potosi.json` para crear domicilios verosímiles en los 28 barrios y avenidas tradicionales de Potosí:

```typescript
interface GeographicCatalog {
  urban_potosi: {
    city_name: string;
    neighborhoods: string[];
    streets_and_avenues: string[];
    address_generation_patterns: string[];
  };
}

export function generatePotosiAddress(geoCatalog: GeographicCatalog): string {
  const urban = geoCatalog.urban_potosi;
  const neighborhood = faker.helpers.arrayElement(urban.neighborhoods);
  const street = faker.helpers.arrayElement(urban.streets_and_avenues);
  const number = faker.number.int({ min: 10, max: 980 });

  const patternIndex = faker.number.int({ min: 1, max: 4 });
  switch (patternIndex) {
    case 1:
      return `${street} Nº ${number}, Zona ${neighborhood}`;
    case 2:
      return `${street} Nº ${number}, Barrio ${neighborhood}`;
    case 3:
      return `${street} s/n, ${neighborhood}`;
    default:
      return `${neighborhood}, ${street} Nº ${number}`;
  }
}
```

---

## 6. Máquina de Estados de la Simulación Académica y Dinámica de Cohortes

La trayectoria de cada estudiante a través de la universidad sigue una máquina de estados determinista gobernada por las regulaciones pedagógicas de la UATF y la Dirección de Servicios Académicos (DSA).

### 6.1. Diagrama del Ciclo de Vida Estudiantil
```
[Postulante]
     │
     ├─ (Rinde Examen en una de las 15 Modalidades)
     │   ├── No Admite (estado='P', nota < umbral) ──► [Fin de Proceso]
     │   └── Admite (estado='A', nota >= umbral)
     ▼
[Estudiante Matriculado (academico.alumnos, estado='P')]
     │
     ▼ (Para cada Semestre/Gestión)
[Inscripción de Asignaturas (alm_programaciones)]
     │ - Respeta Malla Curricular y Cadenas de Prerrequisitos (DAG)
     │ - Control de Arrastres: Máximo 2 asignaturas reprobadas
     │
     ▼ (Desarrollo del Término Académico)
[Evaluación Continua (4 Parciales: 30%, 30%, 20%, 20%)]
     │
     ├─ ¿Rindió < 2 Parciales? (Regla DSA)
     │   └── SÍ ──► [Abandono Formal: nota=0/NULL, estado='X', observacion='abandono_lt2_parciales']
     │              │
     │              └── ¿Sin matrícula en T+1? ──► [Clasificado DESERTOR en ML / DW]
     │
     └── NO (Rindió >= 2 Parciales: Calificación Regular)
         │
         ├── nota >= 51.00 ──► [Aprobado: estado='A', __estado='A']
         │
         └── nota < 51.00 (Reprobado Regular)
             │
             ├── nota in [40.00, 50.99] ──► [Habilitado a 2do Turno]
             │   ├── nota_2da >= 51.00 ──► [Aprobado en 2do Turno: estado='A', __estado='S']
             │   └── nota_2da < 51.00  ──► [Reprobado Definitivo: estado='R']
             │
             └── nota < 40.00 ──► [Reprobado Directo: estado='R']
                                       │
                                       ▼ (Siguiente Semestre)
                     [Arrastre de Materia (Máximo 2) o Retención]
                                       │
                                       ▼ (Al aprobar 100% Malla Curricular)
[Egresado / Titulación (actas_graduacion.graduados, alumnos.estado='A'/'T')]
```

### 6.2. Motor de Calificación y Evaluación Continua (Fórmula 30/30/20/20)
La calificación regular de cada asignatura cursada se estructura matemáticamente sobre una escala de 0.00 a 100.00 puntos:

$$\text{nota} = 0.30 \cdot \text{pparcial} + 0.30 \cdot \text{sparcial} + 0.20 \cdot \text{tparcial} + 0.20 \cdot \text{cparcial}$$

1. **Umbral General UATF:** El estudiante aprueba si $\text{nota} \ge 51.00$.
2. **Excepción Área Económica:** Para las carreras de Auditoría (`COP`, `LAT`, `TSC`), el umbral normativo es $\text{nota} \ge 56.00$.
3. **Segundo Turno (`nota_2da`):**
   - Habilitación: Estudiantes con calificación regular en el intervalo $[40.00, 50.99]$ (`alm_programas.nota_2do_habilitacion = 40`).
   - Evaluación: Prueba de recuperación sobre 100 puntos. Si $\text{nota\_2da} \ge 51.00$, el cursado se cierra como `estado = 'A'` y origen de acta `__estado = 'S'`.
4. **Examen de Mesa (`nota_ex_mesa`):**
   - Instancia extraordinaria ante tribunal para materias reprobadas en gestiones anteriores o pendientes para egreso. Nota mínima aprobatoria: 51.00 puntos.
5. **Calificación Efectiva del Cursado:**
   $$\text{mejor\_nota} = \max(\text{COALESCE}(\text{nota}, 0), \text{COALESCE}(\text{nota\_2da}, 0), \text{COALESCE}(\text{nota\_ex\_mesa}, 0))$$

### 6.3. Implementación Estricta de la Regla de Abandono de la DSA
La Dirección de Servicios Académicos (DSA) distingue analíticamente entre reprobación y deserción mediante el conteo de parciales válidos:

$$\text{parciales\_con\_valor} = \sum_{i=1}^4 \mathbb{I}(\text{nota\_parcial}_i \ne 0 \land \text{nota\_parcial}_i \text{ IS NOT NULL})$$

```typescript
export interface CourseworkEvaluation {
  pparcial: number;
  sparcial: number;
  tparcial: number;
  cparcial: number;
  nota: number | null;
  nota_2da: number;
  nota_ex_mesa: number;
  estado: 'A' | 'R' | 'X';
  observacion: string;
  __estado: string;
}

export function computeCourseGrade(
  p1: number,
  p2: number,
  p3: number,
  p4: number,
  programId: string
): CourseworkEvaluation {
  // 1. Contar evaluaciones con asistencia
  const attendedPartials = [p1, p2, p3, p4].filter((p) => p > 0).length;

  // 2. REGLA DSA: Menos de 2 parciales implica abandono formal
  if (attendedPartials < 2) {
    return {
      pparcial: p1,
      sparcial: p2,
      tparcial: p3,
      cparcial: p4,
      nota: null, // o 0.00
      nota_2da: 0,
      nota_ex_mesa: 0,
      estado: 'X',
      observacion: `DW_TEST_SEED_V2:abandono_lt2_parciales_${attendedPartials}`,
      __estado: 'A',
    };
  }

  // 3. Calificación regular ponderada
  const notaRegular = Number((0.3 * p1 + 0.3 * p2 + 0.2 * p3 + 0.2 * p4).toFixed(2));
  const passingThreshold = ['COP', 'LAT', 'TSC'].includes(programId) ? 56.0 : 51.0;

  if (notaRegular >= passingThreshold) {
    return {
      pparcial: p1,
      sparcial: p2,
      tparcial: p3,
      cparcial: p4,
      nota: notaRegular,
      nota_2da: 0,
      nota_ex_mesa: 0,
      estado: 'A',
      observacion: 'DW_TEST_SEED_V2:regular_aprobado',
      __estado: 'A',
    };
  }

  // 4. Segundo turno si nota in [40.00, 50.99]
  if (notaRegular >= 40.0) {
    const takesSecondTurn = faker.datatype.boolean({ probability: 0.85 });
    if (takesSecondTurn) {
      const nota2da = faker.number.int({ min: 25, max: 75 });
      const passed2da = nota2da >= 51;
      return {
        pparcial: p1,
        sparcial: p2,
        tparcial: p3,
        cparcial: p4,
        nota: notaRegular,
        nota_2da: nota2da,
        nota_ex_mesa: 0,
        estado: passed2da ? 'A' : 'R',
        observacion: passed2da ? 'DW_TEST_SEED_V2:segundo_turno_aprobado' : 'DW_TEST_SEED_V2:segundo_turno_reprobado',
        __estado: passed2da ? 'S' : 'A',
      };
    }
  }

  // Reprobado regular
  return {
    pparcial: p1,
    sparcial: p2,
    tparcial: p3,
    cparcial: p4,
    nota: notaRegular,
    nota_2da: 0,
    nota_ex_mesa: 0,
    estado: 'R',
    observacion: 'DW_TEST_SEED_V2:regular_reprobado',
    __estado: 'A',
  };
}
```

### 6.4. Parámetros Empíricos de Dinámica Longitudinal de Cohortes (2018–2026)
Para alimentar adecuadamente el modelo de Machine Learning (`prepared-dataset-v1`), el simulador debe reproducir las tasas de deserción y retención históricas de la universidad:

1. **Curva de Deserción por Nivel de Avance:**
   - **Primer Año (Semestres 1 y 2):** **18% a 25%** de deserción. Estudiantes vulnerables que rinden $<2$ parciales y no se matriculan en el término subsiguiente.
   - **Segundo Año (Semestres 3 y 4):** **8% a 12%** de deserción.
   - **Años Superiores (Semestres 5 al 10):** Deserción residual **$< 3\%$**.
2. **Materias Filtro (Bottlenecks Curriculares):**
   Las asignaturas troncales iniciales deben simular tasas de reprobación sustancialmente mayores:
   - *Cálculo I (`SIS-102`, `CIV-102`, `MIN-102`), Álgebra Lineal (`SIS-101`), Física I (`SIS-104`), Anatomía Humana I (`MED-101`), Química General (`QMC-101`):* **Tasa de reprobación de 35% a 50%**.
   - Asignaturas intermedias y avanzadas: Tasa de reprobación moderada (10% a 20%).
3. **Límite de Arrastre de Asignaturas:**
   - La normativa UATF estipula un máximo de **2 asignaturas reprobadas** que pueden arrastrarse en paralelo con materias del semestre inmediato superior (`alm_programas.nro_max_arrastres = 2`). Si adeuda 3 o más materias, el estudiante queda bloqueado de inscribir materias avanzadas hasta regularizar.

---

## 7. Directrices Inviolables de Producción (Non-Negotiable Guardrails)

Todo desarrollador o script automatizado que implemente el generador debe cumplir estrictamente con los siguientes 8 mandatos de calidad. Su transgresión corromperá los pipelines analíticos o provocará fallos en tiempo de ejecución.

### Guardrail 1: Prohibición Absoluta de las 24 Columnas Fantasma
Bajo ninguna circunstancia deben incluirse en los comandos `INSERT` o modelos TypeScript las 24 columnas obsoletas eliminadas del esquema activo de PostgreSQL 14.2:
- `public.postulantes`: `nro_impresiones`, `recalificado`, `id_recaudaciones`, `id_postulaciones`, `estado_postulacion`, `estado_envio_daf`.
- `academico.pln_materias`: `imprimir_certificado`, `hrs_semana`, `hrs_semestre`, `creditos`, `hrs_total`, `porcentaje_evaluacion`.
- `academico.alm_programas`: `clave_certificado`, `name_programa`, `carnet_universitario`, `tiene_tramites`, `tiempo_estudio`, `tipo_estadisticas`.
- `public.uatf_datos`: `id_apoderado`, `id_colegio_sie`, `estado_profesional`.
- `academico.alumnos`: `id_tipo_matricula`, `nivel_acad`.
- `academico.notas_planilla`: `_hash`.

### Guardrail 2: Contrato de Extracción de Apache Hop en Carreras (`select_programas.sql`)
Todo programa académico insertado en `academico.alm_programas` debe satisfacer indefectiblemente el predicado SQL:
```sql
_tipo_academico = 'CAR' AND activo = 'A'
```
*Justificación Técnica:* Los scripts legacy insertaban `activo = 'SI'` y omitían `_tipo_academico`, ocasionando que la transformación `pl_dim_programa_mvp.hpl` descartara el 100% de las carreras por descarte en el filtro de extracción.

### Guardrail 3: Integridad Demográfica 100% `alumnos.id_ra` $\leftrightarrow$ `uatf_datos.id_ra`
El 100% de los registros insertados en `academico.alumnos` que cuenten con matrícula `id_ra` informada DEBEN poseer su registro padre preexistente en `public.uatf_datos`.
*Justificación Técnica:* El pipeline `pl_dim_estudiante_scd2_mvp.hpl` y la función de migración `0021_student_scd2_identity_is_id_alumno.sql` lanzan una excepción no recuperable (`RAISE EXCEPTION 'No existe perfil uatf_datos para el id_ra informado'`) si se detecta un estudiante huérfano de perfil demográfico.

### Guardrail 4: Créditos Académicos No Nulos (`pln_materias._creditos`)
Cada asignatura registrada en `academico.pln_materias` debe tener un valor de créditos estrictamente positivo en el rango $[3, 6]$ (`_creditos smallint`).
*Justificación Técnica:* Si `_creditos = 0`, el denominador del cálculo del Promedio Ponderado Acumulado (PPA) colapsa ($\sum \text{creditos} = 0$), produciendo errores de división por cero o anulando la métrica en `dw.fact_retencion_desercion`.

### Guardrail 5: Consistencia de Umbrales de Calificación ($\ge 51.00$ y $\ge 56.00$)
Ninguna fila en `academico.notas_planilla` con `estado = 'A'` puede tener una calificación efectiva menor a 51.00 puntos (o menor a 56.00 puntos en las carreras `COP`, `LAT`, `TSC`). De igual forma, ninguna fila con calificación $\ge 51.00$ puede figurar con `estado = 'R'`.

### Guardrail 6: Invariante de Precedencia Cronológica y Edad
Para toda persona y trayectoria estudiantil simulada se debe verificar la invariante temporal:
$$\text{fec\_nacimiento} + 17\text{ años} \le \text{fec\_registro\_colegio} \le \text{fec\_postulacion} \le \text{fec\_matricula} \le \text{fec\_cursado} < \text{fec\_graduacion}$$

### Guardrail 7: Protección de Desbordamiento de Tipo en Materias
En `academico.pln_materias`, la clave primaria `id_materia` es `integer`, pero en `academico.notas_planilla.id_materia` la columna está definida físicamente como `smallint` (rango máximo: 32,767).
*Regla:* Todos los identificadores generados de asignaturas deben acotarse estrictamente al rango $[1000, 32000]$ para prevenir desbordamientos de entero (`integer out of range for smallint`) durante el cursado.

### Guardrail 8: Cota Inferior de Gestiones Históricas ($\text{gestion} \ge 2000$)
El Data Warehouse institucional aplica una restricción de chequeo estricta en el calendario (`ck_dim_periodo_academico_member_identity` en `0002_create_dw_schema.sql` que exige `gestion >= 2000`). No deben generarse eventos académicos previos al año 2000.

---

## 8. Lista de Verificación y Criterios de Aceptación (QA Checklist)

Antes de dar por concluida la ejecución del generador de seed o aceptar un Pull Request en el repositorio para la Issue #206, el equipo de QA debe ejecutar la siguiente batería de 10 pruebas automatizadas sobre la base de datos PostgreSQL 14.2 poblada:

```sql
-- ============================================================================
-- SUITE DE AUDITORÍA Y ACEPTACIÓN DE CALIDAD DE SEED (ISSUE #206 / DATA-001)
-- ============================================================================

-- TEST 1: Cero Presencia de Columnas Fantasma en Esquema
SELECT count(*) AS phantom_column_violations
FROM information_schema.columns
WHERE (table_schema = 'public' AND table_name = 'postulantes' AND column_name IN ('estado_postulacion','id_recaudaciones','nro_impresiones'))
   OR (table_schema = 'academico' AND table_name = 'pln_materias' AND column_name IN ('creditos','hrs_semana','hrs_total'))
   OR (table_schema = 'academico' AND table_name = 'alm_programas' AND column_name IN ('name_programa','tiempo_estudio','clave_certificado'))
   OR (table_schema = 'public' AND table_name = 'uatf_datos' AND column_name IN ('id_apoderado','id_colegio_sie'))
   OR (table_schema = 'academico' AND table_name = 'alumnos' AND column_name IN ('id_tipo_matricula','nivel_acad'))
   OR (table_schema = 'academico' AND table_name = 'notas_planilla' AND column_name = '_hash');
-- EXPECTED: 0

-- TEST 2: Cero Violaciones de Integridad Referencial Demográfica (alumnos -> uatf_datos)
SELECT count(*) AS orphan_students_count
FROM academico.alumnos a
LEFT JOIN public.uatf_datos u ON a.id_ra = u.id_ra
WHERE a.id_ra IS NOT NULL AND u.id_ra IS NULL;
-- EXPECTED: 0

-- TEST 3: Cumplimiento de Filtros Apache Hop en Programas Académicos
SELECT count(*) AS non_compliant_hop_programs
FROM academico.alm_programas
WHERE upper(btrim(_tipo_academico)) NOT IN ('CAR', 'PRO', 'TES', 'TEM')
   OR upper(btrim(coalesce(activo, ''))) <> 'A';
-- EXPECTED: 0

-- TEST 4: Comprobación de Créditos Válidos en Asignaturas (_creditos > 0)
SELECT count(*) AS invalid_course_credits
FROM academico.pln_materias
WHERE _creditos IS NULL OR _creditos <= 0;
-- EXPECTED: 0

-- TEST 5: Consistencia de Estados de Aprobación vs Calificación Mínima
SELECT count(*) AS grade_status_mismatches
FROM academico.notas_planilla
WHERE (estado = 'A' AND nota < 51.00 AND coalesce(nota_2da, 0) < 51.00 AND coalesce(nota_ex_mesa, 0) < 51.00)
   OR (estado = 'R' AND (nota >= 51.00 OR coalesce(nota_2da, 0) >= 51.00 OR coalesce(nota_ex_mesa, 0) >= 51.00));
-- EXPECTED: 0

-- TEST 6: Verificación de la Regla de Abandono DSA (< 2 parciales)
SELECT count(*) AS dsa_abandonment_violations
FROM academico.notas_planilla
WHERE ((CASE WHEN pparcial > 0 THEN 1 ELSE 0 END +
        CASE WHEN sparcial > 0 THEN 1 ELSE 0 END +
        CASE WHEN tparcial > 0 THEN 1 ELSE 0 END +
        CASE WHEN cparcial > 0 THEN 1 ELSE 0 END) < 2)
  AND estado <> 'X';
-- EXPECTED: 0

-- TEST 7: Protección de Rango Smallint en Materias (id_materia <= 32767)
SELECT count(*) AS smallint_overflow_risks
FROM academico.pln_materias
WHERE id_materia > 32767 OR id_materia < 1;
-- EXPECTED: 0

-- TEST 8: Validación de Precedencia Temporal y Edad Mínima (17 años)
SELECT count(*) AS chronological_inconsistencies
FROM public.uatf_datos u
JOIN academico.alumnos a ON u.id_ra = a.id_ra
WHERE a.fec_inscripcion < (u.fec_nacimiento + INTERVAL '16 years')
   OR a.fec_egreso < a.fec_inscripcion;
-- EXPECTED: 0

-- TEST 9: Diversidad Onomástica Boliviana (Presencia de Top Apellidos Andinos)
SELECT 
  round(100.0 * sum(CASE WHEN paterno IN ('MAMANI','FLORES','QUISPE','CONDORI','CHOQUE') THEN 1 ELSE 0 END) / count(*), 2) AS top5_andean_percentage
FROM public.uatf_datos;
-- EXPECTED: Entre 12.0% y 18.0% (según distribución empírica de grad_2019_2025.xlsx)

-- TEST 10: Validación de Procedencia Departamental (Potosí >= 65%)
SELECT 
  round(100.0 * sum(CASE WHEN tipo_nro_dip = 'PT' THEN 1 ELSE 0 END) / count(*), 2) AS potosi_origin_percentage
FROM public.uatf_datos;
-- EXPECTED: Entre 65.0% y 75.0% (media empírica: 70.0%)
```

---

## 9. Instrucciones de Implementación y Próximos Pasos

1. **Estructura del Proyecto en Node.js:**
   Crear el paquete en `packages/seed-generator/` (o directorio afín designado por Issue #206) con la configuración de TypeScript `tsconfig.json` orientada a Node.js 20+ ESM (`"module": "NodeNext"`, `"target": "ES2022"`).
2. **Dependencias Requeridas:**
   ```json
   {
     "dependencies": {
       "@faker-js/faker": "^10.0.0",
       "pg": "^8.13.0"
     },
     "devDependencies": {
       "@types/node": "^20.17.0",
       "@types/pg": "^8.11.0",
       "typescript": "^5.6.0"
     }
   }
   ```
3. **Ejecución y Carga:**
   Implementar la carga mediante transacciones en lote (`client.query('BEGIN')`, inserción con sentencias multilínea `INSERT INTO ... VALUES (...)`, y `client.query('COMMIT')`) para alcanzar tasas de ingesta superiores a 5,000 registros por segundo en PostgreSQL 14.2.
4. **Verificación Post-Carga:**
   Ejecutar la suite de auditoría del Capítulo 8 para certificar que el entorno está completamente listo para pruebas de extracción ETL con Apache Hop y entrenamiento de Machine Learning.

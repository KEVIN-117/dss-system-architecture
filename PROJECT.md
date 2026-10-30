# Project: UATF Synthetic Seed Reference Data & Catalogs (DATA-001 / Issue #206)

## Architecture
This project establishes the authoritative, production-grade reference datasets, schemas, and demographic/academic catalogs for the simulated OLTP database (`jachasun` on PostgreSQL 14.2) of the Universidad Autónoma Tomás Frías (Potosí, Bolivia).
These artifacts directly unblock and drive the reproducible Node.js / `@faker-js/faker` v10 synthetic seed data generator, ensuring 100% plausible longitudinal student cohorts that seamlessly integrate with downstream Apache Hop ETL pipelines and the ML dropout prediction model.

### Data Flow & System Boundaries
1. **Authoritative Sources (Survey Baseline - Completed)**:
   - Live PostgreSQL 14.2 Introspection & DataGrip Schemas (`C:\Users\krodr\DataGripProjects\default\jachasum`).
   - Official Catalogs (`career_catalog.csv`, `carreras.xlsx`, `localidades.csv`, `colegios.csv`, `grad_2019_2025.xlsx`).
   - Downstream DW Contract (`infra/dw-schema/migrations`, `docs/dw/`, Apache Hop ETL pipelines).
2. **Reference Catalogs & Dictionaries (`docs/seed-data/`)**:
   - Curated, cleansed, structured dictionaries and JSON/CSV catalogs ready for the faker generator.
   - Elimination of the 24 legacy phantom columns from `ddl_jachasun.sql`.
   - Complete 8-level topological insertion order and foreign key dependency map.
3. **Synthetic Seed Generator (Issue #206)**:
   - Node.js 20+ / TypeScript generator using `@faker-js/faker` v10 and controlled project catalogs.
   - Generates multi-year longitudinal cohorts (2018–2026).
4. **Target Systems**:
   - Simulated OLTP: PostgreSQL `jachasun`.
   - Data Warehouse: Apache Hop ETL (`pl_dim_estudiante_scd2_mvp`, `pl_fact_cursado_mvp`, `fact_retencion_desercion`).
   - ML Pipeline: Dropout prediction (`prepared-dataset-v1`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F1 | Saneamiento de Esquema OLTP y Mapeo Topológico | Mapeo exhaustivo de tablas, tipos PG 14.2, descarte de 24 columnas fantasma, y grafo de inserción topológica en 8 niveles para evitar violaciones de FK sin desactivar constraints. | M1 | Survey E1 |
| F2 | Catálogos de Tablas Lookup y Dominios de Código | Códigos oficiales de tablas de lookup del OLTP: estados civiles, tipos de admisión (15 modalidades), estados de alumno (`P`,`B`,`A`,`X`,`T`,`S`), estados de notas (`A`,`R`,`H`,`C`,`S`,`D`), períodos y sedes. | M1 | Survey E1 & E3 |
| F3 | Contrato y Reglas de Simulación DW / ML | Reglas de aprobación $\ge 51$, ponderación de parciales (30/30/20/20), regla de abandono DSA ($<2$ parciales), filtros de Apache Hop (`_tipo_academico='CAR'`, `activo='A'`), e integridad referencial `alumnos.id_ra` $\leftrightarrow$ `uatf_datos.id_ra`. | M1 | Survey E2 |
| F4 | Catálogo Académico UATF Oficial | Estructuración de 13 facultades, 86 carreras (64 semestrales, 21 anuales, grados Licenciatura/TUS/TUM), sedes, siglas, mallas curriculares y cadenas de prerrequisitos. | M2 | Survey E3 |
| F5 | Catálogo Geográfico y Demográfico Boliviano | Distribución de 9 departamentos con extensiones CI, 16 provincias de Potosí, 4,473 localidades reales, zonas urbanas de Potosí y frecuencias empíricas de nombres/apellidos (Quechua, Aymara, Castellano). | M2 | Survey E3 |
| F6 | Catálogo de Unidades Educativas (Colegios) | 5,237 colegios nacionales y 488 de Potosí con códigos SIE, tipo de dependencia (Fiscal 80.7%, Privada 9.9%, Convenio 9.4%), turnos (Mañana, Tarde, Noche) y áreas (Urbana, Rural). | M2 | Survey E3 |
| F7 | Paquete Maestro de Referencia para Seed (@faker-js/faker v10) | Especificación maestra unificada y artefactos JSON/CSV listos para consumo del generador Node.js de la Issue #206. | M3 | Survey E1, E2, E3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Esquema OLTP Saneado, Orden Topológico y Reglas de Simulación | Generación de especificación técnica del esquema PostgreSQL 14.2, mapeo de 26 tablas, tipos, PK/FK, orden topológico de 8 niveles, catálogos de lookup y reglas de evaluación/DW. Archivos: `docs/seed-data/01_oltp_schema_and_topological_mapping.md`, `04_system_lookups_and_simulation_rules.md`, `catalogs/lookup_reference_codes.json`. | none | DONE |
| M2 | Catálogos Académicos, Demográficos, Geográficos y Colegios | Consolidación de 13 facultades, 86 carreras, mallas curriculares, 9 departamentos, 16 provincias, 4,473 localidades, 5,237 colegios, y distribución empírica de nombres/apellidos. Archivos: `docs/seed-data/02_academic_structure_uatf.md`, `03_geographic_demographic_schools_catalog.md`, y JSONs respectivos en `catalogs/`. | none | DONE |
| M3 | Especificación Maestra y Verificación Integral del Seed Package | Compilación de la especificación maestra unificada (`docs/seed-data/00_master_seed_specification.md`), verificación cruzada de consistencia, validación adversarial y auditoría forense. | M1, M2 | DONE |

---

## Interface Contracts
### M1 (OLTP Schema & Rules) ↔ M2 (Academic & Demographics)
- M1 define las tablas físicas y tipos donde se alojarán los programas (`alm_programas`), materias (`pln_materias`), colegios (`prs_colegios`), localidades (`lugar_localidad`) y personas (`uatf_datos`, `alumnos`).
- M2 provee la lista de 85 códigos canónicos de carrera, siglas de materia, códigos SIE de colegios y códigos de localidad para resolución estricta de FKs.

### M1 & M2 ↔ M3 (Master Seed Package)
- M3 integra todas las especificaciones y catálogos en una guía normativa coherente y exhaustiva lista para implementación por el equipo de Node.js / Faker v10 en Issue #206.

---

## Code Layout & Deliverables
```
docs/seed-data/
├── 00_master_seed_specification.md               # [M3] Especificación maestra unificada y Guía para Desarrollador
├── 01_oltp_schema_and_topological_mapping.md     # [M1] Esquema OLTP saneado (26 tablas) y orden topológico (8 niveles)
├── 02_academic_structure_uatf.md                 # [M2] Estructura académica, 13 facultades, 86 carreras, mallas curriculares
├── 03_geographic_demographic_schools_catalog.md  # [M2] Departamentos, 16 provincias, 4,473 localidades, nombres, 5,235 colegios
├── 04_system_lookups_and_simulation_rules.md     # [M1] Tablas de lookup, reglas de evaluación (30/30/20/20), DSA, DW/Hop
└── catalogs/                                     # Datos estructurados JSON listos para @faker-js/faker v10
    ├── demographic_names_surnames.json           # Top 100 apellidos empíricos (Mamani, Flores, etc.), nombres por género
    ├── faculties_and_careers.json                # 13 facultades, 86 programas, sedes, áreas de conocimiento
    ├── geographic_bolivia_potosi.json            # 9 departamentos con extensiones CI, 16 provincias de Potosí, calles
    ├── lookup_reference_codes.json               # 15 modalidades de admisión, estados de alumno y notas, códigos lookup
    ├── schools_catalog.json                      # 5,235 colegios nacionales, 488 Potosí, dependencia, turnos, SIE
    └── study_plans_and_courses.json              # 8 mallas curriculares benchmark y reglas de generación de siglas
```

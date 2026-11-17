# Dataset OLTP sintético para el DW: fuentes, formato y escenario declive/crecimiento

Este documento cubre tres cosas: el inventario de fuentes que alimentan el Data Warehouse académico, el formato del paquete de dataset que produce `tools/seed-generator` y el escenario institucional `decline-growth`, en el que la universidad cae entre 2010 y 2015 y crece desde 2016.

> Todos los datos generados son ficticios. La OLTP `jachasun` local se consultó solo con agregados (conteos, medias y tasas por gestión). No se extrajo ningún registro personal.

---

## 1. Inventario de fuentes de datos

### 1.1 Fuentes internas

| # | Fuente | Tecnología / ubicación | Dominio | Tablas clave | Consumidor DW |
|---|---|---|---|---|---|
| I-1 | **OLTP Jachasun** (sistema académico) | PostgreSQL. DDL de referencia `infra/postgres-tx/ddl/ddl_jachasun.sql`; instancia local `localhost:5490/jachasun` (PG 15.19) | Admisión, vida académica, finanzas, titulación | ver 1.3 | `staging.raw_uatf_datos`, `dim_estudiante` (SCD2), `dim_programa`, `dim_materia`, `dim_admision`, `fact_admision`, `fact_cursado`, `fact_retencion_desercion` |
| I-2 | **Calendario de cierres académicos** | `etl_control.academic_period_closure` (+ `_event`), migraciones 0001 y 0024 | Gobierno del dato: qué periodo está cerrado y autorizado | `academic_period_closure` | `dim_periodo_academico`, compuertas de Hop (0010) |
| I-3 | **Control de ejecución ETL** | `etl_control.etl_execution*`, `etl_source_manifest*`, `etl_work.hop_publication_*` (0003, 0011) | Linaje, métricas y publicación atómica | — | Auditoría y observabilidad |
| I-4 | **Catálogos de referencia** | JSON versionados en `docs/seed-data/catalogs/` | 13 facultades, 86 carreras, mallas, geografía de Potosí, nombres, colegios, 15 modalidades de admisión | — | `ref_*`, seed generator |
| I-5 | **Extractos CSV** | `infra/postgres-tx/extract/`, `jachasun_academico_dct_asignaciones.csv` | Snapshots puntuales de tablas OLTP | — | Fixtures y cierres de prueba (`historical-v2`) |
| I-6 | **Espacio de ML** | `ml_workspace.*` (0026, 0034, 0036) | Jobs de entrenamiento, lotes y publicaciones de predicción | `training_job`, `prediction_batch`, `prediction_result` | Fuente derivada: predicciones de deserción que vuelven a la capa de consumo |

### 1.2 Fuentes externas (catálogos de referencia)

| # | Fuente | Uso en el DW | Cómo entra |
|---|---|---|---|
| E-1 | **INE Bolivia**: división político-administrativa | `ref_departamento`, `ref_provincia`, `ref_ciudad_capital` (0058/0059) y procedencia del postulante | Catálogo estático (`geographic_bolivia_potosi.json`, `lugar_*` de la OLTP) |
| E-2 | **Ministerio de Educación / SIE**: unidades educativas | Colegio de egreso (`prs_colegios.cod_ue`), tipo fiscal o particular | Catálogo `schools_catalog.json` |
| E-3 | **CEUB**: áreas de conocimiento y régimen de carreras | `ref_area_conocimiento`, `ref_programa_area` | `faculties_and_careers.json` (`knowledge_area_code`) |
| E-4 | **Resoluciones HCU/DSA**: calendario y normativa académica | Fechas efectivas de cierre, nota mínima (51), regla de abandono DSA (menos de 2 parciales) | Comando de cierre (0024) y reglas en `lookup_reference_codes.json` |

### 1.3 Perfil de la OLTP Jachasun (instancia local, agregados)

- 155 tablas y 29 vistas en `public`; 60 tablas y 7 vistas en `academico`. Extensiones: `hstore`, `unaccent`, `pgcrypto`, `postgres_fdw`.
- La instancia local no incluye el esquema `actas_graduacion`, aunque el DDL de referencia sí lo define.

| Subdominio | Tabla | Filas (aprox.) | Cobertura |
|---|---|---:|---|
| Identidad | `public.uatf_datos` | 106 820 | — |
| Admisión | `public.postulantes` | 143 154 | 2004–2022 |
| Académico | `academico.alumnos` | 107 560 | 2003–2022 |
| Académico | `academico.alm_programaciones` | 2 720 890 | — |
| Académico | `academico.notas_planilla` | 3 592 517 | 1978–2022 |
| Académico | `academico.pln_materias` | 7 647 | — |
| Académico | `academico.dct_asignaciones` | 116 990 | — |
| Finanzas | `public.matriculas` | 773 644 | — |
| Finanzas | `public.cajas_transacciones` / `valores_transacciones` | 492 158 / 3 053 944 | — |

**Hallazgos de calidad que el ETL debe tratar:**

- Gestiones inválidas: `id_gestion` igual a 1, 2, 3, 201, 1011, 1900 o 2916; `fec_inscripcion` en 1900.
- Picos de carga masiva: 22 463 alumnos con año de inscripción 2003 y 21 822 con 2015, que parecen migraciones y no cohortes reales.
- `notas_planilla.estado` mezcla mayúsculas y minúsculas (`h`, `a`) y casi siempre vale `A`, incluso con notas reprobadas. Por eso el DW deriva aprobado y reprobado de la nota (0044) y abandono de los códigos `X`/`I` (0033).
- Los programas anuales (MED, DER, ENF…) registran la gestión en el periodo 1 con `alm_programas.tipo = 'A'` (0045).
- La instancia local difiere del DDL de referencia en algunas columnas; por ejemplo, `alm_programas.tiempo_estudio` no existe localmente.

**Referencias de calibración** (2006–2021): nota media con nota de 45 a 51, aprobación entre 60 y 72 %, alrededor del 20 % de inscripciones sin nota, admisión entre 53 y 71 %, proporción por sexo 50/50. Las carreras más demandadas son CIV, MED, COP, DER, CTB, ADM, ENF y ARQ.

---

## 2. Formato del dataset (`uatf-oltp-seed` v1.0.0)

```
tools/seed-generator/out/dataset/uatf-seed-<escenario>-s<semilla>-<perfil>/
├── manifest.json                 # contrato sellado del paquete
├── sql/seed_oltp.sql             # carga transaccional (BEGIN…COMMIT) sobre el DDL Jachasun
├── oltp/<esquema>.<tabla>.csv    # 28 tablas pobladas, volcadas desde la base cargada
└── scenario/
    ├── year_factors.csv          # impulsores del escenario por gestión (entrada)
    └── yearly_kpis.csv           # KPIs esperados por gestión (verdad de referencia)
```

**Dialecto CSV:** RFC 4180, UTF-8, separador `,`, comillas `"`, encabezado obligatorio y NULL como campo vacío. Las fechas usan `YYYY-MM-DD` y los timestamps `YYYY-MM-DD HH:MM:SS` sin zona (hora de La Paz). Los nombres de columna coinciden con el DDL de Jachasun, así que cada archivo se puede cargar con `COPY` en la misma tabla. Solo se exportan las columnas con al menos un valor, ordenadas por clave.

**`manifest.json`** contiene:

- `format` y `format_version`;
- `dataset_id`, `generated_at` y `sealed_at`;
- `parameters`: semilla, perfil, escenario, cohorte base y años;
- `target_schema`: DDL y convenciones de periodo, aprobación y abandono;
- `csv_dialect`;
- `files[]`, con `path`, `role` (`load-script` | `table` | `scenario`), `bytes`, `sha256`, `rows` y `columns`.

El manifiesto permite comprobar la integridad (sha256) y el volumen esperado antes de cargar al DW.

**Tablas del paquete:**

- **Catálogos:** `prs_pais_v2`, `_bp_estados_civiles`, `prs_calificacion`, `prs_examen`, `lugar_*`, `prs_colegios`, `carreras_tipos`, `sedes`, `alumnos_estados`, `periodos`, `alm_periodos`, `docentes_tiempo`, `alm_programas_facultades`, `alm_programas`, `docentes`, `pln_materias`, `dct_asignaciones`.
- **Hechos de origen:** `uatf_datos`, `postulantes`, `alumnos`, `matriculas`, `cajas_transacciones`, `valores_transacciones`, `alm_programaciones`, `notas_planilla` y `actas_graduacion.graduados`.

**Convenciones:** los programas semestrales usan los periodos 1 y 2; los anuales, el periodo 1. Una materia se aprueba si `GREATEST(nota, nota_2da, nota_ex_mesa) >= 51`. El abandono formal se marca con `estado = 'X'` y menos de 2 parciales.

---

## 3. Escenario `decline-growth`

Definido en `tools/seed-generator/src/scenarios/institutional-trend.ts`. Cada gestión tiene factores de demanda, selectividad, rendimiento, deserción y titulación. Los conteos no se fijan: salen de la simulación.

| Fase | Gestiones | Demanda | Admisión | Rendimiento | Deserción | Narrativa |
|---|---|---|---|---|---|---|
| BASELINE | ≤ 2009 | 1.00 | ×1.00 | 0 | ×1.00 | Meseta estable (calentamiento desde 2005) |
| DECLINE | 2010–2015 | 0.94 → **0.55** | ×1.02 → 1.16 (menos selectiva) | −0.08 → −0.45 σ | ×1.12 → 1.78 | Caída de matrícula y calidad; 2015 es el piso |
| RECOVERY | 2016–2018 | 0.62 → 0.86 | → ×1.02 | se recupera | ×1.55 → 1.14 | Recuperación |
| GROWTH | 2019, 2021–2026 | 1.00 → **1.48** | ×0.98 → 0.88 (más selectiva) | +0.05 → +0.23 σ | ×1.0 → 0.76 | Crecimiento; apertura de carreras en subsedes (2017–2021) |
| PANDEMIC | 2020 | 1.03 (se frena, no cae) | ×1.00 | +0.18 σ (notas infladas) | ×1.12 | Virtualidad |

**Mecanismos de realismo que añade el simulador:**

- **Habilidad latente** por estudiante, con distribución N(0,1) y un pequeño bonus si viene de colegio particular. Determina el puntaje de ingreso, la probabilidad de aprobar y el riesgo de deserción, así que notas y deserción quedan correlacionadas, lo que el modelo de ML necesita.
- **Deserción en dos formas:** abandono formal (regla DSA) y deserción silenciosa (el estudiante no renueva matrícula). La segunda la detecta el DW como ausencia en el periodo sucesor. El riesgo sube con el fracaso del periodo anterior.
- **Recursado** de materias reprobadas o bloqueadas por prerrequisito, hasta 3 por periodo; alimenta `es_repeticion`. La titulación exige completar la malla.
- **Admisión por modalidad** según el catálogo (PSA, CPU, excelencia…), con corte de puntaje según la tasa de la modalidad y mapeo a los códigos `prs_examen` reales.
- **Demanda por carrera y composición por sexo** calibradas con agregados reales; edades de ingreso concentradas en 18–19 años; segunda convocatoria semestral igual al 30 % de la primera.

**Validación automática** (`tools/seed-generator/docker/validate_seed.sql`):

- Integridad: identidad, programación y matrícula de cada nota; periodo anual; titulados; rangos de nota; créditos.
- Narrativa: la pendiente de postulantes y del % de aprobación debe ser negativa en 2010–2015 y positiva desde 2016, y la matrícula debe superar su piso de 2014–2018.

Una corrida de prueba (perfil `test`, cohorte 120) dio estas cifras:

| Gestión | Postulantes | Matriculados | % aprobación | Titulados |
|---|---:|---:|---:|---:|
| 2009 | 160 | 372 | 77.0 | 3 |
| 2015 | 87 | 374 | 63.9 | 36 |
| 2016 | 96 | 331 | 67.9 | 23 |
| 2026 | 238 | 649 | 81.7 | 59 |

Estas cifras son anteriores a la calibración final del rendimiento, que bajó la aprobación de línea base a cerca del 70 %.

---

## 4. Ejecución automatizada (Docker)

Desde la raíz del repositorio:

```bash
docker compose -f tools/seed-generator/docker-compose.yml run --rm --build seeder
```

1. `oltp-seed` (postgres:15-alpine) crea `jachasun_test` con `create_schemas.sql` y `ddl_jachasun.sql`, más el rol de solo lectura `dw_fixture_reader`.
2. `seeder` (bun 1.3.14) ejecuta, en orden: generar → cargar con `psql` → validar → exportar CSV → sellar el manifiesto.
3. La base queda arriba en `127.0.0.1:${SEED_OLTP_PORT:-55433}` para que Apache Hop la extraiga.

Variables (con sus valores por defecto): `SEED=20260101`, `PROFILE=full`, `SCENARIO=decline-growth`, `START_YEAR=2005`, `END_YEAR=2026`, `COHORT_SIZE` (opcional) y `SEED_OLTP_PORT=55433`. Si ese puerto está ocupado, define otro, por ejemplo `SEED_OLTP_PORT=55491`.

Para reiniciar la base desde cero:

```bash
docker compose -f tools/seed-generator/docker-compose.yml down --volumes
```

**Guardas:** el pipeline solo carga en `jachasun_test`, el SQL con `--clean` vuelve a verificar `current_database()`, y nunca toca la `jachasun` local ni el DW.

**Volumen orientativo:** el perfil `medium` genera unos 16.8k postulantes, 10.7k alumnos, 258k notas y 2.6k titulados (SQL de 107 MB, 9 s). El perfil `full` produce unas 2.5 veces ese volumen.

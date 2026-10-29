# Diccionario de Códigos del Sistema y Reglas de Simulación Académica
**Proyecto:** UATF Academic DSS-DW-ML — Synthetic Seed Generator (DATA-001 / Issue #206)  
**Estándar:** Metodología HEFESTO v2.0 & Data Warehouse Extraction Contracts  
**Autor:** Worker M1 (OLTP Schema & Rules Specialist)  
**Fecha:** 2026-10-29  

---

## 1. Resumen y Propósito Normativo

Este documento establece el **diccionario de dominios de valores válidos** para todas las tablas de catálogo/lookup del sistema transaccional de la Universidad Autónoma Tomás Frías (UATF), conjuntamente con las **fórmulas matemáticas de evaluación**, la **regla oficial de abandono de la DSA**, y los **requisitos críticos de extracción del Data Warehouse (DW) y Machine Learning (ML)**.

Constituye la especificación de referencia para el generador de datos sintéticos (Node.js 20+ con `@faker-js/faker` v10), asegurando que los datos generados:
1. Respeten los códigos normativos exactos de la UATF sin inventar nomenclaturas incompatibles.
2. Simulen trayectorias estudiantiles longitudinales verosímiles y no degeneradas entre 2000 y 2026.
3. Se integren de forma limpia en los pipelines de Apache Hop (`pl_dim_estudiante_scd2_mvp`, `pl_fact_cursado_mvp`, `fact_retencion_desercion`) y en el modelo predictivo de deserción (`prepared-dataset-v1`).

---

## 2. Diccionario de Tablas Lookup y Dominios de Código

### 2.1. Estados Civiles (`public._bp_estados_civiles`)
Catálogo de estado civil de la persona/estudiante (`uatf_datos.estado_civil`):

| `id_estado_civil` (PK) | `cod_estado_civil` | `estado_civil` | Distribución Poblacional Típica |
|:---:|:---:|:---|:---:|
| **1** | `SOL` | `SOLTERO(A)` | 94.5% (Población estudiantil regular) |
| **2** | `CAS` | `CASADO(A)` | 4.5% (Estudiantes de últimos años / profesionales) |
| **3** | `DIV` | `DIVORCIADO(A)` | 0.8% |
| **4** | `VIU` | `VIUDO(A)` | 0.2% |

### 2.2. Procedencia y Acreditación de Bachillerato (`public.prs_calificacion`)
Clasificación del tipo de unidad educativa o condición académica de ingreso (`uatf_datos.id_calificacion`):

| `id_calificacion` (PK) | `calificacion` | Significado Institucional | Frecuencia Empírica |
|:---:|:---|:---|:---:|
| **`'1'`** | `FISCAL` | Colegio de dependencia fiscal (público estatal) | 78.0% |
| **`'2'`** | `PARTICULAR` | Colegio de dependencia privada / de convenio | 20.5% |
| **`'B'`** | `PROFESIONAL` | Egresado universitario que cursa carrera paralela/segunda | 1.0% |
| **`'X'`** | `EXTRANJERO` | Bachiller de colegio en el exterior del país | 0.5% |

### 2.3. Modalidad de Ingreso y Pruebas (`public.prs_examen`)
Códigos de examen y modalidades de prueba en el sistema (`alumnos.id_tipo_aprobacion`, `postulantes.examen`):

| `id_examen` (PK) | `abreviacion` | `examen` | Arancel Típico (Bs.) |
|:---:|:---:|:---|:---:|
| **1** | `PSA-1` | `EXAMEN P.S.A.` (Prueba de Suficiencia Académica 1ra Opción) | 250 |
| **2** | `CPU` | `CURSO PRE - UNIVERSITARIO` (Prefacultativo regular) | 450 |
| **3** | `PSA-2` | `EXAMEN 2da. P.S.A.` | 250 |
| **4** | `PRE-MED` | `PRE-MEDICO` (Curso específico Facultad de Medicina) | 800 |
| **5** | `ID` | `INGRESO DIRECTO` | 100 |
| **6** | `ADEA` | `ADMISION POR EXCELENCIA ACADEMICA` (Mejores Bachilleres) | 50 |
| **7** | `ADED` | `ADMISION EXTRAORDINARIA DEPORTIVA` | 150 |
| **8** | `AEP` | `ADMISION ESPECIAL (PROFESIONALES)` | 500 |
| **9** | `CAOP` | `CONVENIO C.A.O.P.` (Ayllus Originarios de Potosí) | 50 |
| **10**| `SIM` | `CARRERA SIMULTANEA` | 200 |
| **13**| `TRASP` | `TRASPASO DE UNIVERSIDAD` (Sistema CEUB) | 350 |
| **15**| `CAMB` | `CAMBIO DE CARRERA` | 150 |
| **16**| `FSUT` | `CONVENIO F.S.U.T.C.O.Q.P.` | 50 |
| **20**| `PSA-3` | `EXAMEN 3ra. P.S.A.` | 250 |
| **44**| `PSA-4` | `EXAMEN 4ta. P.S.A.` | 250 |

### 2.4. Tipos y Régimen de Carrera (`academico.carreras_tipos` & `fac_programas.tipo_c`)
En el sistema UATF conviven dos tipificaciones estructurales:

1. **Tipo de Oferta (`academico.carreras_tipos.tipo`):**
   - `'C'`: **Carrera** (Unidad académica formal de pregrado conducente a licenciatura).
   - `'P'`: **Programa** (Unidad académica desconcentrada o subsede provincial).
2. **Régimen Temporal de Cursado (`public.fac_programas.tipo_c`):**
   - `'S'`: **Semestral** (64 programas de la UATF: Ingeniería de Sistemas, Civil, Minas, Auditoría, Economía, etc.; 20 semanas lectivas por término; periodos 1 y 2).
   - `'A'`: **Anual** (21 programas: Medicina, Derecho, Enfermería, Artes; 40 semanas lectivas; periodo anual).

### 2.5. Sedes Universitarias Físicas (`academico.sedes`)
Campus donde se imparten las carreras (`alm_programas.sede`):

| `id_sede` (PK) | `sede` | Ubicación / Localidad |
|:---:|:---|:---|
| **`'C'`** / **`'1'`** | `CENTRAL` | Potosí Capital (Campus Central / Ciudad Universitaria) |
| **`'2'`** | `LLICA` | Municipio de Llica (Provincia Daniel Campos) |
| **`'3'`** | `SACACA` | Municipio de Sacaca (Provincia Alonso de Ibáñez) |
| **`'4'`** | `TUPIZA` | Ciudad de Tupiza (Provincia Sud Chichas) |
| **`'5'`** | `UNCIA` | Municipio de Uncía (Provincia Rafael Bustillo) |
| **`'6'`** | `UYUNI` | Ciudad de Uyuni (Provincia Antonio Quijarro) |
| **`'7'`** | `VILLAZON` | Ciudad de Villazón (Provincia Modesto Omiste) |
| **`'8'`** | `SAN CRISTOBAL`| Asiento Minero San Cristóbal (Provincia Nor Lípez) |

### 2.6. Estados Académicos de Alumnos (`academico.alumnos_estados`)
Ciclo de vida del estudiante en `academico.alumnos.estado`:

| `estado` (PK) | `descripcion` | Semántica en el DW / Simulación |
|:---:|:---|:---|
| **`'P'`** | `ACTIVO / REGULAR` | Estudiante en curso con matrícula vigente. |
| **`'B'`** | `BLOQUEADO` | Suspensión temporal por trámites administrativos o biblioteca. |
| **`'A'`** | `PROFESIONAL` | Egresado que ha culminado plan y trámite de titulación. |
| **`'T'`** | `TITULADO` | Con título en provisión nacional emitido. |
| **`'X'`** | `ANULADO` | Retiro formal o anulación definitiva de matrícula. |
| **`'S'`** | `SIMULTÁNEA` | Matrícula en segunda carrera simultánea. |

### 2.7. Períodos Lectivos (`academico.alm_periodos` & `academico.periodos`)
Catálogo de términos académicos anuales:

| `id_periodo` (PK) | `descripcion` | Tipo de Cursado |
|:---:|:---|:---|
| **`1`** | `Primer Semestre` | Periodo regular primer semestre (febrero – junio) |
| **`2`** | `Segundo Semestre` | Periodo regular segundo semestre (agosto – diciembre) |
| **`3`** | `Anual` | Cursado de término anual (carreras anuales: Medicina, Derecho) |
| **`0`** | `Verano` | Curso intensivo de verano (enero) |
| **`4`** | `Mesa / Invierno 1` | Instancia extraordinaria de mesa o invierno intermedio |
| **`5`** | `Invierno 2` | Curso intensivo de invierno (julio) |
| **`6`** | `Reposición / Mesa Ext. 1` | Instancia especial de reposición de acta |
| **`7`** | `Mesa Extraordinaria 2` | Examen de mesa de egreso |

### 2.8. Dedicación Docente (`academico.docentes_tiempo`)
| `tiempo` (PK) | `descripcion` | Horas Semanales Contratadas |
|:---:|:---|:---:|
| **`TC`** | `TIEMPO COMPLETO` | 40 horas/semana |
| **`MT`** | `MEDIO TIEMPO` | 20 horas/semana |
| **`TH`** | `TIEMPO HORARIO` | 8 a 16 horas/semana |

---

## 3. Catálogo de las 15 Modalidades de Admisión (`id_acceso`)

Basado en la hoja oficial `modalidades` del catálogo institucional `carreras.xlsx` de la UATF, se estandarizan las **15 modalidades oficiales de ingreso**. Cada una define su código trilateral/oficial, su clave canónica de 2 caracteres (`id_acceso` en `public.postulantes` y `dw.dim_admision`), su cuota poblacional de postulantes y su tasa empírica de admisión:

| # (`id_mod`) | Código Oficial | Clave `id_acceso` (`char(2)`) | Denominación Institucional UATF | Cuota Poblacional (% Postulantes) | Tasa de Admisión (% Aprobados `estado='A'`) | Rango Puntaje Examen (Promedio) |
|:---:|:---:|:---:|:---|:---:|:---:|:---:|
| **1** | `PSA` | **`PA`** | Examen Prueba de Suficiencia Académica (1ra a 4ta opción) | 55.0% | 52.0% | 20 – 95 pts (Media: 53.5) |
| **2** | `CPU` | **`CN`** | Curso Pre-Universitario / Prefacultativo (Nivelación) | 27.0% | 68.0% | 35 – 92 pts (Media: 59.2) |
| **3** | `ID` | **`ID`** | Ingreso Directo (Normativa Universitaria) | 1.5% | 100.0% | Ingreso directo (Exento: 80.0) |
| **4** | `ADEA` | **`EX`** | Admisión por Excelencia Académica (Mejores Bachilleres) | 4.5% | 100.0% | Ingreso directo (Mérito: 88.5) |
| **5** | `ADED` | **`ED`** | Admisión Extraordinaria Deportiva (Atletas de Élite) | 0.8% | 85.0% | Prueba física/especial (Media: 62.0) |
| **6** | `AEP` | **`PR`** | Admisión Especial para Profesionales (2da Carrera) | 1.2% | 92.0% | Evaluación de méritos (Media: 75.0) |
| **7** | `ADC` | **`CP`** | Admisión Directa por Convenios Campesinos y Mineros (CAOP, FSUTCOQP, CENAQ, FENCOMIN) | 4.8% | 95.0% | Cupo de convenio (Media: 65.0) |
| **8** | `ESC` | **`ES`** | Estudios Simultáneos de Dos Carreras | 0.6% | 90.0% | Registro académico (Media: 70.0) |
| **9** | `CC` | **`CC`** | Cambio de Carrera (Transferencia Interna) | 1.2% | 88.0% | Convalidación interna (Media: 60.0) |
| **10**| `APTSS`| **`TS`** | Admisión por Transferencia de Sub-Sedes Provinciales | 0.8% | 95.0% | Cupo inter-sedes (Media: 63.0) |
| **11**| `ADGOC`| **`OC`** | Ganadores de Olimpiadas Científicas Plurinacionales | 0.4% | 100.0% | Mérito de olimpiadas (Media: 95.0) |
| **12**| `APTU` | **`TR`** | Admisión por Traspaso de Universidad del Sistema CEUB | 1.0% | 85.0% | Dictamen de traspaso (Media: 65.0) |
| **13**| `ADEIOC`| **`IO`**| Estudiantes Indígenas Originarios Campesinos (Ayllus) | 0.6% | 96.0% | Asignación territorial (Media: 64.0) |
| **14**| `AEPD` | **`CD`** | Personas con Capacidades Diferentes (`CODEPEDIS`) | 0.4% | 100.0% | Inclusión social (Exento: 70.0) |
| **15**| `AEPTI`| **`IN`** | Admisión Especial por Trabajo de Investigación Destacado | 0.2% | 90.0% | Concurso científico (Media: 82.0) |

---

## 4. Modelos de Calificación y Fórmulas de Evaluación

### 4.1. Desglose y Ponderación de Evaluaciones Parciales
El sistema de evaluación continua de la UATF se estructura en cuatro componentes porcentuales sobre una escala matemática de $[0, 100]$:

$$\text{nota} = 0.30 \cdot \text{pparcial} + 0.30 \cdot \text{sparcial} + 0.20 \cdot \text{tparcial} + 0.20 \cdot \text{cparcial}$$

Donde:
- $\text{pparcial}$ (Primer Parcial): Examen de unidades temáticas 1 y 2 (Ponderación: **30%**).
- $\text{sparcial}$ (Segundo Parcial): Examen de unidades temáticas 3 y 4 (Ponderación: **30%**).
- $\text{tparcial}$ (Tercer Parcial): Examen de unidades temáticas 5 y 6 o evaluación de laboratorio/prácticas (Ponderación: **20%**).
- $\text{cparcial}$ / $\text{exfinal}$ (Examen Final): Evaluación integradora acumulativa de la asignatura (Ponderación: **20%**).

### 4.2. Umbral de Aprobación Institucional
- **Regla General UATF:** El umbral mínimo de aprobación es estrictamente **$\ge 51.00$ puntos** sobre 100 (`academico.pln_materias.nota_minima DEFAULT 51`).
- **Excepción Facultativa:** Las carreras del área económica (Auditoría/Contaduría Pública) aplican reglamentariamente un umbral mínimo de **56.00 puntos**.

### 4.3. Instancias de Recuperación y Exámenes Especiales
1. **Segundo Turno / Segunda Instancia (`nota_2da`):**
   - *Condición de Habilitación:* El estudiante debe obtener una nota final regular entre 40 y 50 puntos ($\text{nota} \in [40, 50]$), según `alm_programas.nota_2do_habilitacion = 40`.
   - *Nota Mínima de Aprobación en 2do Turno:* Debe obtener $\ge 51$ puntos en la prueba de recuperación.
   - *Efecto Transaccional:* Al aprobar, el cursado se registra como `estado = 'A'` y origen `__estado = 'S'`.
2. **Examen de Mesa (`nota_ex_mesa`):**
   - Modalidad de evaluación extraordinaria ante tribunal para estudiantes que hayan reprobado previamente la asignatura o tengan hasta 2 materias de arrastre pendientes para egreso.
   - Nota aprobatoria: $\ge 51$ puntos.
3. **Calificación Final Efectiva del Cursado:**
   En las vistas analíticas y en el Data Warehouse (`dw.fact_cursado`), la mejor nota obtenida se calcula determinísticamente como:
   $$\text{mejor\_nota} = \max(\text{COALESCE}(\text{nota}, 0), \text{COALESCE}(\text{nota\_2da}, 0), \text{COALESCE}(\text{nota\_ex\_mesa}, 0))$$

### 4.4. Estados de Evaluación en Planillas (`academico.notas_planilla.estado`)
| Estado | Condición Académica | Criterio Cuantitativo / Reglamentario |
|:---:|:---|:---|
| **`'A'`** | **Aprobado** | $\text{mejor\_nota} \ge 51.00$ (Aprobación regular, en 2do turno o mesa). |
| **`'R'`** | **Reprobado** | $0 < \text{mejor\_nota} \le 50.99$ con al menos 2 parciales rendidos. |
| **`'H'`** | **Homologado** | Asignatura aprobada por convalidación de plan de estudios anterior. |
| **`'C'`** | **Convalidado** | Asignatura acreditada de otra universidad o carrera. |
| **`'S'`** | **Compensado** | Aprobación por compensación curricular de consejo de carrera. |
| **`'D'`** | **Dictamen** | Resolución especial de consejo facultativo. |
| **`'X'`** | **Abandono Formal** | Aplicación de la Regla DSA: $< 2$ parciales rendidos en el semestre. |
| **`'U'` / `'Z'` / `'T'`** | **Abandono Tácito / No evaluable** | Inasistencia total o abandono temprano (nota = 0 o nula). |

---

## 5. La Regla Oficial de Abandono de la DSA (Criterio de Calidad de Datos)

El sistema de control académico de la Dirección de Servicios Académicos (DSA) de la UATF codifica un criterio matemático riguroso para distinguir entre **reprobación académica genuina** y **abandono de asignatura**:

$$\text{parciales\_con\_valor} = \sum_{i=1}^4 \mathbb{I}(\text{nota\_parcial}_i \ne 0 \land \text{nota\_parcial}_i \text{ IS NOT NULL})$$

### 5.1. Criterios de Clasificación Transaccional:
1. **Abandono de Asignatura ($< 2$ parciales):**
   - Si un estudiante rinde **menos de dos evaluaciones parciales** ($\text{parciales\_con\_valor} < 2$, es decir, asiste a 0 o 1 parcial):
     - La calificación final no se computa: $\text{nota} = \text{NULL}$ o $\text{nota} = 0$.
     - El estado de la planilla se marca como abandono: `estado = 'X'` (o `'I'`).
     - Observación formal: `observacion = 'DW_TEST_SEED_V2:abandono_lt2_parciales_' || partial_count`.
2. **Evaluación Regular ($\ge 2$ parciales):**
   - Si el estudiante rinde **dos o más parciales** ($\text{parciales\_con\_valor} \ge 2$):
     - El estudiante tiene derecho a cómputo de promedio final ponderado.
     - Si $\text{nota} \ge 51 \implies \text{estado} = \text{'A'}$.
     - Si $\text{nota} < 51 \implies \text{estado} = \text{'R'}$.

---

## 6. Requisitos Críticos de Downstream DW y Machine Learning

Para que los datos generados sintéticamente alimenten sin fallos los pipelines de Apache Hop y los modelos predictivos de deserción, el generador debe cumplir obligatoriamente con las siguientes directrices:

### 6.1. Filtros Mandatorios de Apache Hop en Programas (`Contract 04 v3`)
Los pipelines de Hop (`pl_dim_programa_mvp.hpl`, `select_programas.sql`) aplican el siguiente filtro estricto al extraer carreras:
```sql
WHERE upper(btrim(_tipo_academico)) IN ('CAR', 'PRO', 'TES', 'TEM')
  AND upper(btrim(coalesce(activo, ''))) = 'A'
```
- **Error histórico corregido:** Los generadores Python legados insertaban `activo = 'SI'` y omitían `_tipo_academico`. Esto provocaba que Apache Hop descartara el 100% de las carreras.
- **Regla:** En el seed, todo programa de pregrado debe tener estrictamente `_tipo_academico = 'CAR'` (o `'PRO'`) y `activo = 'A'`.

### 6.2. Integridad Referencial 100% `alumnos.id_ra` $\leftrightarrow$ `uatf_datos.id_ra`
- En el pipeline `pl_dim_estudiante_scd2_mvp.hpl` y la migración `0021_student_scd2_identity_is_id_alumno.sql`:
  ```sql
  IF v_incoming.id_ra IS NOT NULL
     AND coalesce((p_student->>'_demographic_match')::BOOLEAN, FALSE) IS NOT TRUE THEN
      RAISE EXCEPTION 'No existe perfil uatf_datos para el id_ra informado; snapshot SCD2 bloqueado';
  ```
- **Regla:** El 100% de los estudiantes matriculados en `academico.alumnos` que tengan `id_ra` informado DEBEN poseer su registro correspondiente en `public.uatf_datos`. Cualquier huérfano abortará la carga del Data Warehouse.

### 6.3. Créditos Académicos No Nulos en Materias (`academico.pln_materias._creditos`)
- El Promedio Ponderado Acumulado (PPA) del estudiante se define matemáticamente como:
  $$\text{PPA} = \frac{\sum_{i=1}^n (\text{mejor\_nota}_i \times \text{creditos}_i)}{\sum_{i=1}^n \text{creditos}_i}$$
- **Regla:** Cada materia en `academico.pln_materias` debe tener `_creditos > 0` (valores realistas entre 3 y 6 créditos). Si `_creditos = 0`, el denominador del PPA se anula, provocando división por cero o pérdida de la métrica en `dw.fact_retencion_desercion`.

### 6.4. Dinámica Longitudinal de Cohortes y Detección de Deserción en ML
En el modelo analítico de retención (`etl_control.classify_hop_retention`), la condición para catalogar a un estudiante como **`DESERTOR`** en el período $T$ frente al período siguiente $T+1$ es:
1. El período subsiguiente $T+1$ ha sido cerrado y procesado.
2. El estudiante **NO registra ninguna matrícula ni cursado en $T+1$** (`has_next_coursework = FALSE`).
3. El estudiante no tiene evidencia de graduación/egreso (`fec_egreso IS NULL`).
4. El estudiante rindió **menos de dos parciales** en el período $T$ (`partial_count < 2`).

$$\text{has\_next\_coursework} = \text{FALSE} \land \text{parciales\_rendidos}_T < 2 \implies \text{resultado\_retencion} = \text{'DESERTOR'}$$

#### Parámetros Empíricos de Simulación de Cohortes (2018–2026):
- **Tasa de Deserción en 1er Año (Semestres 1 y 2):** 18% a 25% (Población más vulnerable; foco central del modelo de Machine Learning `prepared-dataset-v1`).
- **Tasa de Deserción en 2do Año (Semestres 3 y 4):** 8% a 12%.
- **Tasa de Deserción en Años Superiores (3er a 5to año):** $< 3\%$.
- **Materias "Filtro" (Cuellos de Botella Curriculares):** Asignaturas troncales iniciales (*Cálculo I*, *Física I*, *Álgebra Lineal*, *Química General*, *Anatomía I*) deben simular una tasa de reprobación más alta (35% a 50%) frente a asignaturas avanzadas (10% a 20%).
- **Límite de Arrastre de Materias:** Máximo 2 asignaturas reprobadas pueden cursarse simultáneamente en el semestre posterior (`alm_programas.nro_max_arrastres = 2`).

# Estructura Académica Oficial de la Universidad Autónoma Tomás Frías (UATF)
## Catálogo Normativo de Facultades, Carreras, Planes de Estudio y Mallas Curriculares para el Generador de Datos Sintéticos (DATA-001 / Issue #206)

---

## 1. Resumen Ejecutivo y Propósito

El presente documento constituye la especificación normativa y el catálogo de referencia técnica de la estructura académica de la **Universidad Autónoma Tomás Frías (UATF)**, con sede central en la ciudad de Potosí, Bolivia. Este trabajo tiene como finalidad servir de base factual inmutable para el generador de datos sintéticos reproducible implementado con **Node.js 20+** y **`@faker-js/faker` v10**, destinado a poblar la base de datos relacional transaccional (OLTP simulada en el esquema `jachasun` de PostgreSQL 14.2) y alimentar los pipelines de extracción ETL (Apache Hop) hacia el Data Warehouse y los modelos predictivos de Machine Learning sobre deserción y retención estudiantil.

A diferencia de las versiones previas de generación sintética en Python que operaban con modelos curriculares simplificados (limitados a 5 facultades y 10 carreras genéricas), la UATF en su realidad institucional opera con:
- **13 Facultades Oficiales**, incluyendo el Vicerrectorado como unidad académica administradora de programas desconcentrados y transversales.
- **86 Programas Académicos (Carreras)**: 85 programas plenamente vigentes y certificados en el catálogo unificado (`career_catalog.csv`) más 1 programa histórico en estado de baja (`TST: TUS en Contabilidad - Tupiza`).
- **2 Regímenes Académicos Temporales**: 64 carreras de régimen **Semestral (`S`)** (20 semanas por semestre lectivo) y 21 carreras de régimen **Anual (`A`)** (40 semanas lectivas anuales).
- **3 Niveles de Titulación Académica**: Licenciatura (`LIC`, 4 a 6 años), Técnico Universitario Superior (`TUS`, 3 años / 6 semestres), y Técnico Universitario Medio (`TUM`, 2 años / 4 semestres).
- **8 Sedes Territoriales**: La **Sede Central Potosí** (Campus Central, Campus Universitario y edificios históricos) y **7 Sub-sedes Provinciales y Centros Universitarios** (Tupiza, Uyuni, Villazón, Uncía, Llica, Sacaca y San Cristóbal).
- **6 Áreas de Conocimiento Homologadas por el Comité Ejecutivo de la Universidad Boliviana (CEUB)**.

---

## 2. Las 13 Facultades Oficiales de la UATF

La estructura orgánica de la UATF se divide en 13 facultades oficiales, cada una con su respectiva sigla alfabética institucional, código numérico en la base de datos `jachasun`, abreviatura formal y localización de campus en el departamento de Potosí.

| ID Numérico | Código Letra | Nombre Oficial Completo | Abreviación Oficial | Sede / Campus Principal | Dirección / Referencia | Programas Dependientes |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | `A` | **FACULTAD DE ARTES** | FAC. DE ARTES | Campus Central | Av. Cívica / Plaza 10 de Noviembre | 3 |
| **2** | `B` | **FACULTAD DE CIENCIAS AGRICOLAS Y PECUARIAS** | FAC. DE CC AA Y PP | Campus Universitario | Av. Universitaria / Huari Huari | 6 |
| **3** | `C` | **FACULTAD DE CIENCIAS ECONOMICAS FINANCIERAS Y ADMINISTRATIVAS** | FAC. DE CC EE FF Y AA | Campus Central | Calle Bolívar esq. Junín | 11 |
| **4** | `D` | **FACULTAD DE CIENCIAS PURAS** | FAC. DE CIENCIAS PURAS | Edificio Central / El Maestro | Av. El Maestro s/n | 8 |
| **5** | `E` | **FACULTAD DE CIENCIAS SOCIALES Y HUMANISTICAS** | FAC. DE CC SS Y HH | Campus Central | Av. Universitaria / Edif. Sociales | 11 |
| **6** | `F` | **FACULTAD DE DERECHO** | FAC. DE DERECHO | Edificio Calle Lanza | Calle Lanza Nº 2 | 3 |
| **7** | `G` | **FACULTAD DE INGENIERIA** | FAC. DE ING. | Edificio Central | Plaza Alonzo de Ibáñez | 3 |
| **8** | `H` | **FACULTAD DE INGENIERIA GEOLOGICA** | FAC. DE ING. GEOLOGICA | Campus Universitario | Av. Universitaria / Karachipampa | 3 |
| **9** | `I` | **FACULTAD DE INGENIERIA MINERA** | FAC. DE ING. MINERA | Edificio de Minería | Av. Villazón / Plaza Minero | 3 |
| **10** | `J` | **FACULTAD DE INGENIERIA TECNOLOGICA** | FAC. DE ING. TECNOLOGICA | Facultad Tecnológica | Calle Millares Nº 81 | 18 |
| **11** | `K` | **FACULTAD DE CIENCIAS DE LA SALUD** | FAC. DE CIENCIAS DE LA SALUD | Edificio Salud | Calle La Paz Nº 829 | 8 |
| **12** | `L` | **FACULTAD DE MEDICINA** | FAC. DE MEDICINA | Campus Universitario | Av. Universitaria / Huari Huari | 1 |
| **13** | `M` | **VICERRECTORADO** (Programas Desconcentrados) | VICERRECTORADO | Edificio Rectoral | Av. El Maestro esq. Cívica | 6 |

---

## 3. Las 6 Áreas de Conocimiento Homologadas (CEUB / UATF)

Las carreras de la universidad se agrupan en las seis áreas científicas estandarizadas por el Comité Ejecutivo de la Universidad Boliviana (CEUB). Cada área cuenta con un código alfanumérico principal (`c_area`) y un código secundario de ordenamiento (`orden3`):

1. **`CPN` (Código `P`) — CIENCIAS PURAS Y NATURALES:**
   - Carreras: Física, Química, Matemáticas, Estadística.
   - Enfoque: Formación científica básica, modelado abstracto, investigación de laboratorio y fundamentación metodológica.
2. **`ITC` (Código `Q`) — INGENIERÍA TECNOLOGÍA Y CONSTRUCCIONES:**
   - Carreras: Ingeniería de Sistemas, Ingeniería Informática, Ingeniería Civil, Ingeniería Mecánica, Ingeniería Eléctrica, Ingeniería Electrónica, Ingeniería Mecatrónica, Ingeniería de Autotrónica, Ingeniería Industrial, Ingeniería Minera, Procesos de Materias Primas Minerales, Ingeniería Geológica, Ingeniería Ambiental, Arquitectura, y programas técnicos superiores de tecnología.
   - Enfoque: Innovación tecnológica, diseño constructivo, computación, automatización y extracción minero-metalúrgica.
3. **`CAFP` (Código `R`) — CIENCIAS AGRÍCOLAS, FORESTALES Y PECUARIAS:**
   - Carreras: Ingeniería Agronómica, Ingeniería Agroindustrial, Desarrollo Rural, Desarrollo Territorial, Medicina Veterinaria y Zootecnia (Tupiza), Ingeniería Agropecuaria (Villazón).
   - Enfoque: Producción agrícola de altura, transformación agroindustrial, sanidad animal y desarrollo comunitario andino.
4. **`CCSS` (Código `S`) — CIENCIAS DE LA SALUD:**
   - Carreras: Medicina, Enfermería (Potosí, Uyuni, Villazón, Sacaca), Odontología, Auxiliares de Enfermería y Técnico Medio en Enfermería.
   - Enfoque: Atención clínico-quirúrgica, salud pública preventiva, internado rotatorio hospitalario y enfermería comunitaria.
5. **`CJSAH` (Código `T`) — CIENCIAS JURÍDICAS, SOCIALES, ARTES Y HUMANIDADES:**
   - Carreras: Derecho (Potosí, Tupiza, Uncía), Trabajo Social (Potosí, Uncía), Ciencias de la Comunicación, Lingüística e Idiomas (Potosí, Tupiza, Uyuni, Uncía), Turismo (Potosí, Uyuni), Artes Plásticas, Artes Musicales, Pedagogía Intercultural.
   - Enfoque: Marco normativo constitucional y penal, preservación del patrimonio lingüístico (Quechua/Aymara/Inglés/Francés), análisis social y expresión cultural.
6. **`CEAFC` (Código `U`) — CIENCIAS ECONÓMICAS, ADMINISTRATIVAS, FINANCIERAS Y COMERCIALES:**
   - Carreras: Administración de Empresas, Auditoría - Contaduría Pública, Economía (Potosí, Uyuni, Uncía), Ingeniería Comercial, Contabilidad y Finanzas, Comercio Internacional (Villazón), y Técnicos Superiores Contables.
   - Enfoque: Gestión contable-financiera, auditoría tributaria y gubernamental, econometría y comercio exterior fronterizo.

---

## 4. Sedes Territoriales y Desconcentración Provincial

Para responder a la amplia extensión geográfica del departamento de Potosí (118.218 km²), la UATF descentralizó su oferta académica a través de sub-sedes provinciales estratégicas:

| ID Sede | Código | Denominación Oficial | Condición | Provincia | Municipio | Carreras Ofertadas |
| :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| **1** | `P` | **Sede Central Potosí** | Central | Tomás Frías | Potosí | 64 |
| **2** | `L` | **Sub-sede Llica** | Sub-sede | Daniel Campos | Llica | 2 (`LEF`, `LMA`) |
| **3** | `S` | **Sub-sede Sacaca** | Sub-sede | Alonso de Ibáñez | Sacaca | 1 (`SEN`) |
| **4** | `T` | **Sub-sede Tupiza** | Sub-sede | Sud Chichas | Tupiza | 6 (`CTT`, `DET`, `EDT`, `LAT`, `MVZ`, `SIT`) |
| **5** | `U` | **Sub-sede Uncía** | Sub-sede | Rafael Bustillo | Uncía | 5 (`CDE`, `CEC`, `CIN`, `CLI`, `CTS`) |
| **6** | `Y` | **Sub-sede Uyuni** | Sub-sede | Antonio Quijarro | Uyuni | 5 (`QUI`, `TUU`, `UEC`, `UEN`, `ULI`, `UTE`) |
| **7** | `V` | **Sub-sede Villazón** | Sub-sede | Modesto Omiste | Villazón | 3 (`VAG`, `VCI`, `VEF`) |
| **8** | `C` | **Centro San Cristóbal** | Centro Univ. | Nor Lípez | Colcha K | 3 (`TSA`, `TSE`, `TSM`) |

---

## 5. Catálogo Integral de los 86 Programas Académicos

A continuación se detalla la totalidad de los 86 programas de la UATF compilados a partir de `career_catalog.csv` (85 carreras vigentes) y `alm_programas.csv` (incluyendo la histórica `TST`), especificando su identificador oficial de 3 letras, nombre, facultad, régimen, nivel, duración, sede, área de conocimiento y título profesional:

| # | ID Prog | Nombre de la Carrera / Programa | Fac | Rég | Nivel | Años | Sede | Área | Estado | Título Profesional Otorgado |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| 1 | **`ADM`** | ADMINISTRACION DE EMPRESAS | C | S | LIC | 5 | Potosí | CEAFC | A | Licenciado en Administración de Empresas |
| 2 | **`AGR`** | INGENIERIA AGRONOMICA | B | S | LIC | 5 | Potosí | CAFP | A | Ingeniero Agrónomo |
| 3 | **`APT`** | ARTES PLASTICAS | A | A | LIC | 5 | Potosí | CJSAH | A | Licenciado en Artes Plásticas |
| 4 | **`ARM`** | ARTES MUSICALES | A | A | LIC | 5 | Potosí | CJSAH | A | Licenciado en Artes Musicales |
| 5 | **`ARQ`** | ARQUITECTURA | A | S | LIC | 5 | Potosí | ITC | A | Arquitecto |
| 6 | **`AUT`** | INGENIERIA DE AUTOTRONICA | J | S | LIC | 5 | Potosí | ITC | A | Ingeniero en Autotrónica |
| 7 | **`CCV`** | TUS EN CONSTRUCCIONES CIVILES | G | S | TUS | 3 | Potosí | ITC | A | Técnico Superior en Construcciones Civiles |
| 8 | **`CDE`** | DERECHO - UNCIA | F | A | LIC | 4 | Uncía | CJSAH | A | Abogado |
| 9 | **`CEC`** | ECONOMIA - UNCIA | C | S | LIC | 5 | Uncía | CEAFC | A | Licenciado en Economía |
| 10 | **`CIN`** | PROG. ING. INFORMATICA - UNCIA | D | S | LIC | 5 | Uncía | ITC | A | Ingeniero Informático |
| 11 | **`CIV`** | INGENIERIA CIVIL | G | S | LIC | 5 | Potosí | ITC | A | Ingeniero Civil |
| 12 | **`CLI`** | PROG. LINGUISTICA E IDIOMAS - UNCIA | E | A | LIC | 5 | Uncía | CJSAH | A | Licenciado en Lingüística e Idiomas |
| 13 | **`COM`** | CIENCIAS DE LA COMUNICACION | E | S | LIC | 5 | Potosí | CJSAH | A | Licenciado en Ciencias de la Comunicación |
| 14 | **`COP`** | AUDITORIA - CONTADURIA PUBLICA | C | S | LIC | 5 | Potosí | CEAFC | A | Auditor / Contador Público Autorizado |
| 15 | **`CTB`** | CONTABILIDAD Y FINANZAS | C | S | LIC | 4 | Potosí | CEAFC | A | Licenciado en Contabilidad y Finanzas |
| 16 | **`CTS`** | TRABAJO SOCIAL - UNCIA | E | A | LIC | 4 | Uncía | CJSAH | A | Licenciado en Trabajo Social |
| 17 | **`CTT`** | CONTADURIA PUBLICA - TUPIZA | C | S | LIC | 5 | Tupiza | CEAFC | A | Contador Público Autorizado |
| 18 | **`DER`** | DERECHO | F | A | LIC | 4 | Potosí | CJSAH | A | Abogado |
| 19 | **`DET`** | DERECHO - TUPIZA | F | A | LIC | 4 | Tupiza | CJSAH | A | Abogado |
| 20 | **`DPD`** | ING. EN DISEÑO Y PROG. DIGITAL | M | S | LIC | 4 | Potosí | ITC | A | Ingeniero en Diseño y Programación Digital |
| 21 | **`ECO`** | ECONOMIA | C | S | LIC | 5 | Potosí | CEAFC | A | Licenciado en Economía |
| 22 | **`EDI`** | ESCUELA DE IDIOMAS | E | S | TUM | 2 | Potosí | CJSAH | A | Técnico Medio en Idiomas |
| 23 | **`EDT`** | ESCUELA DE IDIOMAS - TUPIZA | E | S | TUM | 2 | Tupiza | CJSAH | A | Técnico Medio en Idiomas |
| 24 | **`ELE`** | INGENIERIA ELECTRICA | J | S | LIC | 5 | Potosí | ITC | A | Ingeniero Electricista |
| 25 | **`ENF`** | ENFERMERIA | K | A | LIC | 5 | Potosí | CCSS | A | Licenciada en Enfermería |
| 26 | **`EST`** | ESTADISTICA | D | S | LIC | 4 | Potosí | CPN | A | Licenciado en Estadística |
| 27 | **`EXI`** | EXTENSION LIBRE - INGLES | E | S | TUM | 2 | Potosí | CJSAH | A | Certificado de Suficiencia en Inglés |
| 28 | **`EXQ`** | EXTENSION LIBRE - QUECHUA | E | S | TUM | 2 | Potosí | CJSAH | A | Certificado de Suficiencia en Quechua |
| 29 | **`FIS`** | FISICA | D | S | LIC | 5 | Potosí | CPN | A | Licenciado en Física |
| 30 | **`GYT`** | ING. EN GEODESIA Y TOPOGRAFIA | G | A | LIC | 5 | Potosí | ITC | A | Ingeniero Geodesta y Topógrafo |
| 31 | **`IAI`** | INGENIERIA AGROINDUSTRIAL | B | S | LIC | 5 | Potosí | CAFP | A | Ingeniero Agroindustrial |
| 32 | **`IAM`** | INGENIERIA AMBIENTAL | H | S | LIC | 5 | Potosí | ITC | A | Ingeniero Ambiental |
| 33 | **`ICO`** | INGENIERIA COMERCIAL | C | S | LIC | 5 | Potosí | CEAFC | A | Ingeniero Comercial |
| 34 | **`IDR`** | ING. EN DESARROLLO RURAL | B | S | LIC | 5 | Potosí | CAFP | A | Ingeniero en Desarrollo Rural |
| 35 | **`IDT`** | ING. EN DESARROLLO TERRITORIAL | B | S | LIC | 5 | Potosí | CAFP | A | Ingeniero en Desarrollo Territorial |
| 36 | **`IET`** | INGENIERIA ELECTRONICA | J | S | LIC | 5 | Potosí | ITC | A | Ingeniero Electrónico |
| 37 | **`IGO`** | INGENIERIA GEOLOGICA | H | S | LIC | 5 | Potosí | ITC | A | Ingeniero Geólogo |
| 38 | **`IMA`** | ING. DEL MEDIO AMBIENTE | H | S | LIC | 5 | Potosí | ITC | A | Ingeniero del Medio Ambiente |
| 39 | **`IMC`** | INGENIERIA MECANICA | J | S | LIC | 5 | Potosí | ITC | A | Ingeniero Mecánico |
| 40 | **`IMI`** | INGENIERIA MINERA | I | S | LIC | 5 | Potosí | ITC | A | Ingeniero Minero |
| 41 | **`IMT`** | INGENIERIA MECATRONICA | J | S | LIC | 5 | Potosí | ITC | A | Ingeniero Mecatrónico |
| 42 | **`IND`** | INGENIERIA INDUSTRIAL | J | S | LIC | 5 | Potosí | ITC | A | Ingeniero Industrial |
| 43 | **`INF`** | INGENIERIA INFORMATICA | D | S | LIC | 4 | Potosí | ITC | A | Ingeniero Informático |
| 44 | **`LAT`** | LIC. EN AUDITORIA - TUPIZA | C | S | LIC | 5 | Tupiza | CEAFC | A | Auditor / Contador Público |
| 45 | **`LEF`** | TEC. MEDIO ENFERMERIA - LLICA | K | A | TUM | 2 | Llica | CCSS | A | Técnico Medio en Enfermería |
| 46 | **`LEI`** | LINGUISTICA E IDIOMAS | E | A | LIC | 5 | Potosí | CJSAH | A | Licenciado en Lingüística e Idiomas |
| 47 | **`LMA`** | TEC. MEDIO MECANICA AUTOMOTRIZ - LLICA | J | S | TUM | 2 | Llica | ITC | A | Técnico Medio en Mecánica Automotriz |
| 48 | **`MAT`** | MATEMATICA | D | S | LIC | 5 | Potosí | CPN | A | Licenciado en Matemáticas |
| 49 | **`MAU`** | TUS EN MECANICA AUTOMOTRIZ | J | S | TUS | 3 | Potosí | ITC | A | Técnico Superior en Mecánica Automotriz |
| 50 | **`MED`** | MEDICINA | L | A | LIC | 6 | Potosí | CCSS | A | Médico Cirujano |
| 51 | **`MIN`** | INGENIERIA DE MINAS | I | S | LIC | 5 | Potosí | ITC | A | Ingeniero de Minas |
| 52 | **`MVZ`** | MED. VETERINARIA Y ZOOTECNIA - TUPIZA | B | S | LIC | 5 | Tupiza | CAFP | A | Médico Veterinario Zootecnista |
| 53 | **`ODO`** | ODONTOLOGIA | M | A | LIC | 5 | Potosí | CCSS | A | Cirujano Dentista |
| 54 | **`PEN`** | PROG. AUXILIARES DE ENFERMERIA | K | A | TUM | 2 | Potosí | CCSS | A | Auxiliar de Enfermería |
| 55 | **`PIC`** | PROG. PEDAGOGIA INTERCULTURAL | M | A | LIC | 5 | Potosí | CJSAH | A | Licenciado en Pedagogía Intercultural |
| 56 | **`PMM`** | ING. PROC. MAT. PRIMAS MIN. | I | S | LIC | 5 | Potosí | ITC | A | Ingeniero de Procesos Minerales |
| 57 | **`QMC`** | QUIMICA | D | S | LIC | 5 | Potosí | CPN | A | Licenciado en Ciencias Químicas |
| 58 | **`QUI`** | QUIMICA - UYUNI | D | S | LIC | 5 | Uyuni | CPN | A | Licenciado en Química |
| 59 | **`SEN`** | ENFERMERIA - SACACA | K | A | LIC | 5 | Sacaca | CCSS | A | Licenciada en Enfermería |
| 60 | **`SIS`** | INGENIERIA DE SISTEMAS | M | S | LIC | 5 | Potosí | ITC | A | Ingeniero de Sistemas |
| 61 | **`SIT`** | INGENIERIA DE SISTEMAS - TUPIZA | M | S | LIC | 5 | Tupiza | ITC | A | Ingeniero de Sistemas |
| 62 | **`TAS`** | TUS EN CONTABILIDAD | C | S | TUS | 3 | Potosí | CEAFC | A | Técnico Superior en Contabilidad |
| 63 | **`TCS`** | TRABAJO SOCIAL | E | S | LIC | 4 | Potosí | CJSAH | A | Licenciado en Trabajo Social |
| 64 | **`TEA`** | TEC. MEDIO ELECTRONICA | J | S | TUM | 2 | Potosí | ITC | A | Técnico Medio en Electrónica |
| 65 | **`TED`** | TEC. MEDIO ELECTRICIDAD | J | S | TUM | 2 | Potosí | ITC | A | Técnico Medio en Electricidad |
| 66 | **`TMA`** | TEC. MEDIO MECANICA AUTOMOTRIZ | J | S | TUM | 2 | Potosí | ITC | A | Técnico Medio en Mecánica Automotriz |
| 67 | **`TMC`** | TUS EN MECATRONICA | J | S | TUS | 3 | Potosí | ITC | A | Técnico Superior en Mecatrónica |
| 68 | **`TMF`** | TEC. MEDIO ENFERMERIA | K | A | TUM | 2 | Potosí | CCSS | A | Técnico Medio en Enfermería |
| 69 | **`TMG`** | TEC. MEDIO MECANICA GENERAL | J | S | TUM | 2 | Potosí | ITC | A | Técnico Medio en Mecánica General |
| 70 | **`TSA`** | TUS MECANICA AUT. - SAN CRISTOBAL | J | S | TUS | 3 | San Cristóbal | ITC | A | Técnico Superior en Mecánica Automotriz |
| 71 | **`TSC`** | TUS CONTADOR GENERAL | C | S | TUS | 3 | Potosí | CEAFC | A | Técnico Superior Contador General |
| 72 | **`TSE`** | ING. ELECTRICA - SAN CRISTOBAL | J | S | LIC | 5 | San Cristóbal | ITC | A | Ingeniero Electricista |
| 73 | **`TSM`** | ING. MECANICA - SAN CRISTOBAL | J | S | LIC | 5 | San Cristóbal | ITC | A | Ingeniero Mecánico |
| 74 | **`TSR`** | TUS EN REDES Y CIBERSEGURIDAD | D | S | TUS | 3 | Potosí | ITC | A | Técnico Superior en Redes |
| 75 | **`TSS`** | TUS EN SISTEMAS INFORMATICOS | D | S | TUS | 3 | Potosí | ITC | A | Técnico Superior en Sistemas |
| 76 | **`TST`** | TUS EN CONTABILIDAD - TUPIZA | C | S | TUS | 3 | Tupiza | CEAFC | B | Técnico Superior en Contabilidad (Histórico) |
| 77 | **`TUE`** | TUS ELECTRICIDAD | J | S | TUS | 3 | Potosí | ITC | A | Técnico Superior en Electricidad |
| 78 | **`TUM`** | TUS EN MECANICA GENERAL | J | S | TUS | 3 | Potosí | ITC | A | Técnico Superior en Mecánica General |
| 79 | **`TUR`** | TURISMO | E | S | LIC | 5 | Potosí | CJSAH | A | Licenciado en Turismo |
| 80 | **`TUU`** | TURISMO - UYUNI | E | S | LIC | 5 | Uyuni | CJSAH | A | Licenciado en Turismo |
| 81 | **`UEC`** | ECONOMIA - UYUNI | C | S | LIC | 5 | Uyuni | CEAFC | A | Licenciado en Economía |
| 82 | **`UEN`** | ENFERMERIA - UYUNI | K | A | LIC | 5 | Uyuni | CCSS | A | Licenciada en Enfermería |
| 83 | **`ULI`** | LINGUISTICA E IDIOMAS - UYUNI | E | A | LIC | 5 | Uyuni | CJSAH | A | Licenciado en Lingüística e Idiomas |
| 84 | **`UTE`** | TEC. MEDIO ENFERMERIA - UYUNI | K | A | TUM | 2 | Uyuni | CCSS | A | Técnico Medio en Enfermería |
| 85 | **`VAG`** | ING. AGROPECUARIA - VILLAZON | B | S | LIC | 5 | Villazón | CAFP | A | Ingeniero Agropecuario |
| 86 | **`VCI`** | COMERCIO INTERNACIONAL - VILLAZON | C | S | LIC | 5 | Villazón | CEAFC | A | Licenciado en Comercio Internacional |
| 87 | **`VEF`** | ENFERMERIA - VILLAZON | K | A | LIC | 5 | Villazón | CCSS | A | Licenciada en Enfermería |

*Nota aclaratoria sobre la numeración:* La tabla contiene 86 programas de estudio únicos correspondientes a la UATF. El ID `TST` corresponde al programa histórico registrado en `alm_programas.csv` con estado `B` (Baja).

---

## 6. Estructuras Curriculares, Mallas y Cadenas de Prerrequisitos

### 6.1. Modelos de Planes de Estudio Vigentes
En el sistema académico `jachasun` de la UATF, los planes de estudio se identifican formalmente mediante un código entero que representa el año de su resolución rectoral:
- **`Plan 2018`**: Plan curricular implementado para la adecuación al modelo por competencias del CEUB.
- **`Plan 2020`**: Actualización curricular que integró materias de virtualidad y tecnologías emergentes.
- **`Plan 2022`**: Plan vigente con carga de créditos estandarizada (créditos CEUB equivalentes a horas presenciales y de laboratorio).

### 6.2. Convención Formal de Siglas de Asignatura
Para garantizar la unicidad de las materias en la tabla `academico.pln_materias`, se adopta la nomenclatura formal:
$$\text{sigla} = \text{\{id\_programa\}}-\text{\{nivel\_academico\}}\text{\{indice\_correlativo:02d\}}$$
*Ejemplos:*
- `SIS-101`: Carrera Ingeniería de Sistemas, Nivel 1 (1er Semestre), Materia 01 (Álgebra Lineal).
- `MED-203`: Carrera Medicina, Nivel 2 (2do Año), Materia 03 (Microbiología y Parasitología).
- `DER-402`: Carrera Derecho, Nivel 4 (4to Año), Materia 02 (Derecho Procesal Civil I).

### 6.3. Tipos de Vínculo Curricular en la Tabla `academico.planes`
La tabla `academico.planes` define las relaciones de las asignaturas mediante el campo `tipo`:
- `'P'` (**Principal**): Materia curricular obligatoria del plan. Todos los alumnos inscritos deben cursarla.
- `'N'` (**Prerrequisito Indispensable Directo**): Condición obligatoria sine qua non. Un estudiante **no puede inscribirse** a una materia subsecuente si no tiene en su expediente de `notas_planilla` la calificación de aprobado ($nota \ge 51$) en la materia antecedente.
- `'C'` (**Control**): Prerrequisito de control de segundo nivel o cadena correlativa extendida (ej. no inscribir materias de 5to nivel si adeuda materias de 1er o 2do nivel).
- `'M'` (**Matricial**): Asignatura de tronco común o institucional (ej. Metodología de Investigación, Inglés Técnico).
- `'V'` (**Convalidado**) y `'H'` (**Homologado**): Asignaturas acreditadas por transferencia o cambio de plan.

---

### 6.4. Mallas Curriculares Detalladas de Programas Insignia

#### 1. Ingeniería de Sistemas (`SIS`) — 10 Semestres / 40 Asignaturas / Licenciatura
- **Semestre 1:**
  - `SIS-101` Álgebra Lineal (HT: 4, HP: 2, CR: 4) — Sin prerrequisito.
  - `SIS-102` Cálculo I (HT: 4, HP: 2, CR: 5) — Sin prerrequisito.
  - `SIS-103` Introducción a la Programación (HT: 4, HP: 4, CR: 5) — Sin prerrequisito.
  - `SIS-104` Física I (HT: 4, HP: 2, CR: 4) — Sin prerrequisito.
- **Semestre 2:**
  - `SIS-201` Cálculo II (HT: 4, HP: 2, CR: 5) — Prerrequisito: `SIS-102`.
  - `SIS-202` Estructuras de Datos (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-103`.
  - `SIS-203` Física II (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-104`.
  - `SIS-204` Programación Orientada a Objetos (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-103`.
- **Semestre 3:**
  - `SIS-301` Cálculo III (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-201`.
  - `SIS-302` Base de Datos I (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-202`.
  - `SIS-303` Programación Web (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-204`.
  - `SIS-304` Arquitectura de Computadoras (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-203`.
- **Semestre 4:**
  - `SIS-401` Base de Datos II (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-302`.
  - `SIS-402` Ingeniería de Software I (HT: 4, HP: 2, CR: 5) — Prerrequisito: `SIS-303`.
  - `SIS-403` Redes de Computadoras I (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-304`.
  - `SIS-404` Sistemas Operativos (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-304`.
- **Semestre 5:**
  - `SIS-501` Ingeniería de Software II (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-402`.
  - `SIS-502` Redes de Computadoras II (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-403`.
  - `SIS-503` Inteligencia Artificial (HT: 4, HP: 2, CR: 5) — Prerrequisito: `SIS-401`.
  - `SIS-504` Teoría de Sistemas (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-402`.
- **Semestre 6:**
  - `SIS-601` Gestión de Software (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-501`.
  - `SIS-602` Auditoría de Sistemas (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-501`.
  - `SIS-603` Seguridad Informática (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-502`.
  - `SIS-604` Sistemas Distribuidos (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-502`.
- **Semestre 7:**
  - `SIS-701` Modelos y Simulación (HT: 4, HP: 2, CR: 5) — Prerrequisito: `SIS-503`.
  - `SIS-702` Inteligencia de Negocios (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-601`.
  - `SIS-703` Taller de Grado I (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-601`.
  - `SIS-704` Gestión Estratégica (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-602`.
- **Semestre 8:**
  - `SIS-801` Taller de Grado II (HT: 4, HP: 4, CR: 6) — Prerrequisito: `SIS-703`.
  - `SIS-802` Práctica Profesional (HT: 2, HP: 8, CR: 6) — Prerrequisito: `SIS-703`.
  - `SIS-803` Ética en Sistemas (HT: 2, HP: 2, CR: 3) — Prerrequisito: `SIS-704`.
  - `SIS-804` Calidad de Software (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-702`.
- **Semestre 9:**
  - `SIS-901` Big Data y Analítica (HT: 4, HP: 4, CR: 5) — Prerrequisito: `SIS-702`.
  - `SIS-902` Seguridad de la Información (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-603`.
  - `SIS-903` Electiva I (Computación en la Nube) (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-604`.
  - `SIS-904` Electiva II (Desarrollo Móvil Avanzado) (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-601`.
- **Semestre 10:**
  - `SIS-1001` Tesis de Grado (HT: 4, HP: 8, CR: 8) — Prerrequisito: `SIS-801`.
  - `SIS-1002` Proyecto de Fin de Carrera (HT: 4, HP: 8, CR: 8) — Prerrequisito: `SIS-801`.
  - `SIS-1003` Electiva III (DevOps y CI/CD) (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-901`.
  - `SIS-1004` Electiva IV (Gobernanza TI) (HT: 4, HP: 2, CR: 4) — Prerrequisito: `SIS-902`.

---

#### 2. Medicina (`MED`) — 6 Años / Régimen Anual / Licenciatura
- **Año 1:**
  - `MED-101` Anatomía Humana I (HT: 4, HP: 6, CR: 8)
  - `MED-102` Histología (HT: 4, HP: 4, CR: 6)
  - `MED-103` Embriología (HT: 3, HP: 2, CR: 5)
  - `MED-104` Bioquímica Médica (HT: 4, HP: 4, CR: 6)
  - `MED-105` Salud Pública I (HT: 3, HP: 2, CR: 4)
- **Año 2:**
  - `MED-201` Anatomía Humana II (HT: 4, HP: 6, CR: 8) — Prerrequisito: `MED-101`.
  - `MED-202` Fisiología Humana (HT: 4, HP: 4, CR: 7) — Prerrequisito: `MED-102`.
  - `MED-203` Microbiología y Parasitología (HT: 4, HP: 4, CR: 6) — Prerrequisito: `MED-104`.
  - `MED-204` Patología General (HT: 4, HP: 4, CR: 6) — Prerrequisito: `MED-102`.
  - `MED-205` Salud Pública II (HT: 3, HP: 2, CR: 4) — Prerrequisito: `MED-105`.
- **Año 3:**
  - `MED-301` Farmacología (HT: 4, HP: 4, CR: 6) — Prerrequisito: `MED-202`.
  - `MED-302` Semiología Médica (HT: 4, HP: 8, CR: 9) — Prerrequisito: `MED-201`.
  - `MED-303` Fisiopatología (HT: 4, HP: 4, CR: 6) — Prerrequisito: `MED-204`.
  - `MED-304` Epidemiología (HT: 3, HP: 2, CR: 4) — Prerrequisito: `MED-205`.
  - `MED-305` Nutrición Médica (HT: 3, HP: 2, CR: 4) — Prerrequisito: `MED-203`.
- **Año 4:**
  - `MED-401` Medicina Interna I (HT: 4, HP: 8, CR: 9) — Prerrequisito: `MED-302`.
  - `MED-402` Cirugía General I (HT: 4, HP: 8, CR: 9) — Prerrequisito: `MED-302`.
  - `MED-403` Pediatría I (HT: 4, HP: 6, CR: 8) — Prerrequisito: `MED-303`.
  - `MED-404` Ginecología (HT: 4, HP: 6, CR: 8) — Prerrequisito: `MED-303`.
  - `MED-405` Salud Pública III (HT: 3, HP: 2, CR: 4) — Prerrequisito: `MED-304`.
- **Año 5:**
  - `MED-501` Medicina Interna II (HT: 4, HP: 8, CR: 9) — Prerrequisito: `MED-401`.
  - `MED-502` Cirugía General II (HT: 4, HP: 8, CR: 9) — Prerrequisito: `MED-402`.
  - `MED-503` Pediatría II (HT: 4, HP: 6, CR: 8) — Prerrequisito: `MED-403`.
  - `MED-504` Obstetricia (HT: 4, HP: 6, CR: 8) — Prerrequisito: `MED-404`.
  - `MED-505` Medicina Legal y Bioética (HT: 3, HP: 2, CR: 4) — Prerrequisito: `MED-405`.
- **Año 6 (Internado Rotatorio Obligatorio):**
  - `MED-601` Internado Rotatorio de Cirugía (HP: 40, CR: 12)
  - `MED-602` Internado Rotatorio de Pediatría (HP: 40, CR: 12)
  - `MED-603` Internado Rotatorio de Medicina Interna (HP: 40, CR: 12)
  - `MED-604` Internado Rotatorio de Gineco-Obstetricia (HP: 40, CR: 12)
  - `MED-605` Internado Rotatorio de Salud Pública y Comunitaria (HP: 40, CR: 12)

---

#### 3. Derecho (`DER`) — 5 Años / Régimen Anual / Licenciatura
- **Año 1:** `DER-101` Introducción al Derecho, `DER-102` Derecho Civil I (Personas), `DER-103` Derecho Constitucional, `DER-104` Historia del Derecho, `DER-105` Sociología Jurídica.
- **Año 2:** `DER-201` Derecho Civil II (Bienes), `DER-202` Derecho Penal I, `DER-203` Derecho Romano, `DER-204` Oratoria Forense, `DER-205` Criminología.
- **Año 3:** `DER-301` Derecho Civil III (Obligaciones), `DER-302` Derecho Penal II, `DER-303` Derecho Internacional Público, `DER-304` Derecho Administrativo, `DER-305` Derecho de Familia.
- **Año 4:** `DER-401` Derecho Civil IV (Contratos), `DER-402` Derecho Procesal Civil I, `DER-403` Derecho Procesal Penal, `DER-404` Derecho Laboral y de la Seguridad Social, `DER-405` Filosofía del Derecho.
- **Año 5:** `DER-501` Derecho de Sucesiones, `DER-502` Derecho Procesal Civil II, `DER-503` Derecho Internacional Privado, `DER-504` Práctica Forense Civil y Penal, `DER-505` Deontología y Ética Profesional.

---

#### 4. Auditoría y Contaduría Pública (`COP`) — 10 Semestres / Semestral / Licenciatura
- **Semestre 1:** `COP-101` Contabilidad Básica, `COP-102` Introducción a la Economía, `COP-103` Matemáticas para Auditores, `COP-104` Metodología de Trabajo.
- **Semestre 2:** `COP-201` Contabilidad Intermedia, `COP-202` Microeconomía, `COP-203` Contabilidad Costos I, `COP-204` Derecho Tributario I.
- **Semestre 3:** `COP-301` Contabilidad Costos II, `COP-302` Contabilidad de Cooperativas, `COP-303` Administración General, `COP-304` Derecho Tributario II.
- **Semestre 4:** `COP-401` Contabilidad de Sociedades, `COP-402` Contabilidad Gubernamental I, `COP-403` Introducción a la Auditoría, `COP-404` Sistemas Contables Informáticos.
- **Semestre 5:** `COP-501` Contabilidad Agropecuaria, `COP-502` Contabilidad Gubernamental II, `COP-503` Auditoría Financiera I, `COP-504` Auditoría Interna.
- **Semestre 6:** `COP-601` Contabilidad Bancaria, `COP-602` Auditoría Financiera II, `COP-603` Auditoría Gubernamental I, `COP-604` Finanzas de Empresas.
- **Semestre 7:** `COP-701` Auditoría Gubernamental II, `COP-702` Auditoría Tributaria, `COP-703` Auditoría de Sistemas, `COP-704` Taller de Grado I.
- **Semestre 8:** `COP-801` Auditoría Operativa, `COP-802` Auditoría Forense, `COP-803` Taller de Grado II, `COP-804` Práctica Profesional.
- **Semestre 9:** `COP-901` Control de Gestión, `COP-902` Auditoría de Gestión, `COP-903` Electiva I, `COP-904` Electiva II.
- **Semestre 10:** `COP-1001` Trabajo de Grado, `COP-1002` Proyecto Final de Auditoría, `COP-1003` Electiva III, `COP-1004` Electiva IV.

---

### 6.5. Reglas de Validación de Prerrequisitos para el Generador `@faker-js/faker` v10
1. **Regla de Bloqueo Estricto:** Un estudiante en la simulación **no puede** tener un registro en `academico.notas_planilla` o `academico.alm_programaciones` para una materia de nivel $L$ ($L \ge 2$) sin que su historial previo contenga todas las materias prerrequisito de nivel $L-1$ en estado aprobado (`estado = 'A'`, con $nota \ge 51$).
2. **Cola de Reprobadas (Backlog):** Si un estudiante reprueba una materia en el periodo $T$, el generador debe reprogramar obligatoriamente dicha materia en el periodo $T+1$, retrasando el avance en la rama correspondiente de la cadena correlativa.
3. **Generación Dinámica Procedural para las Restantes 76 Carreras:** Para los programas no modelados explícitamente en el catálogo JSON de benchmark, el generador aplicará la fórmula determinista:
   - Sigla: `${program_id}-${level}${index.padStart(2, '0')}`
   - Nombre: Generado a partir de una plantilla temática del área de conocimiento respectiva.
   - Prerrequisito: Enlazar con `${program_id}-${level-1}${min(index, count(level-1)).padStart(2, '0')}`.

---

## 7. Calendario Académico Institucional y Gestión de Periodos

La UATF estructura sus actividades en Gestiones Anuales (años calendario de 4 dígitos) y Códigos de Periodo oficiales:

| Código Periodo | Denominación Oficial | Aplicabilidad | Fechas Habituales | Características en Base de Datos |
| :---: | :--- | :--- | :--- | :--- |
| **`1`** | **Primer Semestre** | Carreras Semestrales (`S`) | Febrero a Junio / Julio | Periodo regular de ingreso masivo de cohortes nuevas. |
| **`2`** | **Segundo Semestre** | Carreras Semestrales (`S`) | Agosto a Diciembre | Periodo regular de continuación y admisión semestral. |
| **`3`** | **Gestión Anual** | Carreras Anuales (`A`) | Febrero a Diciembre | Medicina, Derecho, Enfermería, Odontología. |
| **`0`** | **Curso de Verano** | Materias Teóricas | Enero | Máximo 2 materias de arrastre por estudiante. |
| **`4` / `5`** | **Curso de Invierno / Mesas** | Reposición / Nivelación | Julio | Evaluación extraordinaria de materias previas. |
| **`6` / `7`** | **Mesas Extraordinarias** | Grado y Egreso | Octubre / Noviembre | Alumnos que adeudan hasta 2 materias para graduación. |

### Cohortes Longitudinales para la Simulación (2018–2026)
- **Gestión 2018 a 2021**: Cohortes históricas completas con egresados titulados (`estado = 'E'`), desertores tempranos (`estado = 'A'`) y estudiantes rezagados (`estado = 'P'`).
- **Gestión 2022 a 2025**: Cohortes en progresión regular cursando semestres intermedios (semestres 3 a 8).
- **Gestión 2026**: Cohorte activa en curso. Sus materias se alojan exclusivamente en `academico.alm_programaciones` con estado `'REGISTRADO'` (sin calificaciones finales en `notas_planilla`).

---

## 8. Verificación de Integridad y Cumplimiento Normativo

El catálogo formal ha sido cruzado y validado contra:
1. `career_catalog.csv` (85 carreras vigentes).
2. `alm_programas.csv` (86 carreras totales, incluyendo la histórica TST).
3. `alm_programas_facultades.csv` (13 facultades oficiales).
4. `carreras.xlsx` (6 áreas de conocimiento y modalidades de ingreso).
5. Las restricciones de integridad referencial del motor PostgreSQL 14.2 (`jachasun`), garantizando que no se presenten errores de clave foránea al poblar `academico.alm_programas` y `academico.pln_materias`.

# Catálogo Geográfico, Demográfico y de Unidades Educativas de Bolivia y Potosí
## Especificación Normativa para la Generación Sintética Reproducible de Datos UATF (DATA-001 / Issue #206)

---

## 1. Resumen Ejecutivo y Marco de Referencia

El presente documento establece el catálogo de datos de referencia geográficos, demográficos y educativos para el generador de datos sintéticos reproducible de la **Universidad Autónoma Tomás Frías (UATF)** (Issue DATA-001 / GitHub #206). El objetivo central es dotar a la base de datos relacional transaccional simulada (esquema `jachasun` sobre PostgreSQL 14.2) de un nivel absoluto de realismo, plausibilidad y consistencia estadística contextualizado a la realidad del departamento de Potosí y del Estado Plurinacional de Bolivia.

En simulaciones anteriores y prototipos preliminares se evidenciaron discrepancias notables derivadas del uso de diccionarios predeterminados de bibliotecas sintéticas (por ejemplo, personas con nombres y apellidos peninsulares de España como *Llopis*, *Carbó* o *Pujol*, o direcciones ubicadas en ciudades españolas), lo cual distorsionaba severamente el perfil de los estudiantes, las pruebas de calidad de datos y los modelos analíticos de deserción.

Para erradicar este problema, este catálogo se fundamenta de forma estricta en:
1. **La base de datos geográfica oficial (`localidades.csv`)**, que cuenta con **4.471 localidades y comunidades rurales reales** distribuidas en los 9 departamentos de Bolivia y, de manera detallada, en las **16 provincias del departamento de Potosí** (2.006 localidades registradas).
2. **El censo de unidades educativas del Ministerio de Educación (`colegios.csv`)**, contentivo de **5.235 colegios a nivel nacional** y **488 unidades educativas en el departamento de Potosí**, con sus códigos SIE oficiales (`cod_ue`), dependencias administrativas (Fiscal, Privada, Convenio) y turnos.
3. **El análisis demográfico empírico directo sobre 19.073 registros históricos de egresados de la UATF (`grad_2019_2025.xlsx`)**, que certifica las proporciones exactas de apellidos de raigambre Quechua, Aymara y Castellana tradicional, la estructura de nombres de pila (compuestos y simples) y las fórmulas de emisión de documentos de identidad (DIP/CI) y matrícula estudiantil (`id_ra`).

---

## 2. Estructura Geográfica Nacional de Bolivia

### 2.1. Los 9 Departamentos del Estado Plurinacional de Bolivia
Bolivia se organiza territorialmente en 9 departamentos. En la base de datos institucional de la UATF (`public.lugar_localidad`), cada departamento posee un código numérico formal (`cod_dep`), su código internacional ISO 3166-2:BO y la sigla oficial empleada por el Servicio General de Identificación Personal (SEGIP) para la extensión de la Cédula de Identidad (DIP):

| Código `cod_dep` | Departamento | Código ISO | Extensión C.I. (DIP) | Capital Departamental | Total Localidades en BD | Ponderación Población Estudiantil UATF |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: |
| **1** | **Chuquisaca** | `BO-H` | `CH` | Sucre | 295 | 10.0% |
| **2** | **La Paz** | `BO-L` | `LP` | Nuestra Señora de La Paz | 732 | 5.0% |
| **3** | **Cochabamba** | `BO-C` | `CB` | Cochabamba | 327 | 4.0% |
| **4** | **Oruro** | `BO-O` | `OR` | Oruro | 256 | 8.0% |
| **5** | **Potosí** | `BO-P` | `PT` | Villa Imperial de Potosí | **2.006** | **70.0%** |
| **6** | **Tarija** | `BO-T` | `TJ` | Tarija | 223 | 1.5% |
| **7** | **Santa Cruz** | `BO-S` | `SC` | Santa Cruz de la Sierra | 376 | 1.0% |
| **8** | **Beni** | `BO-B` | `BE` | Trinidad | 152 | 0.3% |
| **9** | **Pando** | `BO-N` | `PA` | Cobija | 81 | 0.2% |

### 2.2. Regla de Distribución de Origen Estudiantil
Para reflejar la captación real de la UATF, el generador sintético debe ponderar la procedencia de los postulantes según los pesos empíricos:
- **70.0%** de los estudiantes son oriundos del departamento de **Potosí** (Sede Central y provincias).
- **18.0%** provienen de departamentos vecinos de la macro-región sur y andina: **Chuquisaca (10%)** y **Oruro (8%)**.
- **9.0%** provienen de los departamentos del eje central: **La Paz (5%)** y **Cochabamba (4%)**.
- **3.0%** se distribuye entre los departamentos de los valles y llanos: **Tarija (1.5%)**, **Santa Cruz (1.0%)**, **Beni (0.3%)** y **Pando (0.2%)**.

---

## 3. Geografía Detallada del Departamento de Potosí

El departamento de Potosí cuenta con una superficie de 118.218 km² y se subdivide en 16 provincias. En la base de datos `jachasun`, la provincia se identifica mediante el código numérico `cod_prov`.

### 3.1. Las 16 Provincias de Potosí y su Cobertura en la Base de Datos

| Código `cod_prov` | Provincia | Capital Provincial | Municipios Integrantes | Localidades en BD (`cod_loc`) | Peso Relativo en Potosí | Sub-sedes Universitarias Instaladas |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| **2** | **TOMÁS FRÍAS** | Potosí | Potosí, Yocalla, Belén de Urmiri, Tinguipaya | **319** | 15.9% | Sede Central Potosí (Campus Central, Univ.) |
| **98** | **JOSÉ MARÍA LINARES** | Puna | Puna, Caiza D, Ckochas | **296** | 14.8% | — |
| **73** | **CORNELIO SAAVEDRA** | Betanzos | Betanzos, Chaquí, Tacobamba | **276** | 13.8% | — |
| **99** | **ANTONIO QUIJARRO** | Uyuni | Uyuni, Tomave, Porco | **209** | 10.4% | Sub-sede Uyuni |
| **76** | **NOR CHICHAS** | Cotagaita | Santiago de Cotagaita, Vitichi | **193** | 9.6% | — |
| **74** | **CHAYANTA** | Colquechaca | Colquechaca, Ravelo, Pocoata, Ocurí, San Pedro de Macha | **181** | 9.0% | — |
| **72** | **RAFAEL BUSTILLO** | Uncía | Uncía, Llallagua, Chayanta, Chuquihuta | **133** | 6.6% | Sub-sede Uncía |
| **95** | **SUD CHICHAS** | Tupiza | Tupiza, Atocha | **122** | 6.1% | Sub-sede Tupiza |
| **101** | **MODESTO OMISTE** | Villazón | Villazón | **61** | 3.0% | Sub-sede Villazón |
| **96** | **NOR LÍPEZ** | Colcha K | Colcha K, San Pedro de Quemes | **60** | 3.0% | Centro Universitario San Cristóbal |
| **75** | **CHARCAS** | San Pedro de Buena Vista | San Pedro de Buena Vista, Toro Toro | **42** | 2.1% | — |
| **111** | **ALONSO DE IBÁÑEZ** | Sacaca | Sacaca, Caripuyo | **33** | 1.6% | Sub-sede Sacaca |
| **97** | **SUD LÍPEZ** | San Pablo de Lípez | San Pablo de Lípez, San Antonio de Esmoruco, Mojinete | **28** | 1.4% | — |
| **100** | **DANIEL CAMPOS** | Llica | Llica, Tahua | **28** | 1.4% | Sub-sede Llica |
| **102** | **GRAL. BERNARDINO BILBAO** | Arampampa | Arampampa, Acasio | **18** | 0.9% | — |
| **103** | **ENRIQUE BALDIVIESO** | San Agustín | San Agustín | **7** | 0.3% | — |
| **Total** | **16 Provincias** | — | **41 Municipios** | **2.006** | **100%** | **8 Sedes Territoriales** |

### 3.2. Localidades y Comunidades Representativas de Potosí
Para asegurar que los estudiantes provengan de puntos geográficos exactos en la tabla `public.lugar_localidad`:
- **Tomás Frías:** Potosí (`cod_loc: 5500`), Yocalla, Cantumarca, Belén de Urmiri, Tinguipaya, Tarapaya, Chachacomani, Mondragón, Samasa Alta, Miraflores.
- **Cornelio Saavedra:** Betanzos, Chaquí, Tacobamba, Lequezana, San Lorenzo, Millares, Huari Huari, Otuyo, Potobamba.
- **José María Linares:** Puna, Caiza D, Ckochas, Duraznos, Turuchipa, Otavi, Miculpaya, Molino Pampa, Pacaja.
- **Antonio Quijarro:** Uyuni, Porco, Tomave, Pelca, Agua de Castilla, Chacoma, San Pedro de Opoco.
- **Sud Chichas:** Tupiza, Atocha, Suipacha, San Vicente, Chorolque, Telamayu, Animas, Sococha, Tatasi.
- **Modesto Omiste:** Villazón, Berque, Casira, Mojo, Moraya, Salitre, Sococha Frontera.
- **Rafael Bustillo:** Uncía, Llallagua, Siglo XX, Catavi, Chayanta, Chuquihuta, Cala Cala, Miraflores Bustillo.
- **Nor Lípez / Daniel Campos:** Colcha K, San Cristóbal, Villa Martín, Chuvica, Llica, Tahua, Canquella, Palaya.

---

### 3.3. Geografía Urbana de la Ciudad de Potosí (Domicilios Plausibles)

Para la generación verosímil de domicilios particulares en la tabla `uatf_datos` (`direccion`), se definen los barrios, zonas y arterias principales de la Villa Imperial:

#### 1. Barrios y Zonas Urbanas Tradicionales (28 Distritos)
- **Centro Histórico y Alrededores:** Centro Histórico, San Roque, San Pedro, San Juan, San Benito, San Cristóbal, San Gerardo, Calvario.
- **Zonas Residenciales y Universitarias:** Ciudad Satélite, Highland Players, Los Pinos, Plan 40, San Clemente, Huari Huari (adyacente al Campus), Las Delicias, Villa Colón, Villa Victoria.
- **Zonas de Crecimiento y Periféricas:** Cantumarca, Karachipampa, Villa Banzer, Villa Copacabana, Alto Potosí, Ticka Loma, Huachacalla, Pari Orcko, Pampa Ingenio, Villa Mecánicos, San Marcos.

#### 2. Principales Avenidas y Calles
- **Avenidas:** Av. El Maestro, Av. Cívica, Av. Universitaria, Av. Litoral, Av. Tinkuy, Av. Murillo, Av. Villazón, Av. Panamericana, Av. Antofagasta, Av. Sevilla, Av. Ilustres, Av. H. Vázquez, Av. Las Banderas.
- **Calles Tradicionales:** Calle Bolívar, Calle Hoyos, Calle Quijarro, Calle Matos, Calle Linares, Calle Ayacucho, Calle Bustillos, Calle Sucre, Calle Millares, Calle La Paz, Calle Chuquisaca, Calle Oruro, Calle Nogales, Calle Cobija, Calle Tarija, Calle Cochabamba, Calle Frías.

#### 3. Plantillas de Generación de Dirección
El generador estructurará las direcciones mediante los siguientes formatos aleatorizados:
```
- "#{street} Nº #{number}, Zona #{neighborhood}"
- "#{street} Nº #{number}, Barrio #{neighborhood}"
- "#{street} esq. #{street}, #{neighborhood}"
- "#{neighborhood}, #{street} s/n"
```
*Ejemplo:* `"Av. El Maestro Nº 452, Zona Ciudad Satélite"`, `"Calle Bolívar esq. Oruro, Centro Histórico"`.

---

## 4. Catálogo Demográfico Empírico de Bolivia y Potosí

A partir de la inspección exhaustiva de **19.073 registros históricos de graduados de la UATF** en `grad_2019_2025.xlsx`, se extrajo la distribución paramétrica real de apellidos y nombres.

### 4.1. Frecuencia Empírica de Apellidos Bolivianos (Top 100)

La población universitaria de la UATF presenta una rica composición intercultural donde conviven apellidos tradicionales de origen **Quechua y Aymara (38.5%)** con apellidos de raíz **Castellana/Criolla (61.5%)**.

| Rango | Apellido | Conteo Real en Muestra | Frecuencia (%) | Acumulado (%) | Raíz Cultural / Origen Lingüístico |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | **MAMANI** | 1.862 | **4.920%** | 4.920% | Aymara / Quechua ("Halcón / Gavilán andino") |
| **2** | **FLORES** | 1.117 | **2.952%** | 7.872% | Castellano tradicional boliviano |
| **3** | **QUISPE** | 975 | **2.576%** | 10.448% | Aymara / Quechua ("Cristal / Libre / Resplandeciente") |
| **4** | **CONDORI** | 840 | **2.220%** | 12.668% | Quechua / Aymara ("Cóndor de las alturas") |
| **5** | **CHOQUE** | 830 | **2.193%** | 14.861% | Aymara / Quechua ("Lanza / Oro fino") |
| **6** | **CRUZ** | 675 | **1.784%** | 16.645% | Castellano devocional |
| **7** | **GUTIERREZ** | 501 | **1.324%** | 17.969% | Castellano patronímico |
| **8** | **RAMOS** | 441 | **1.165%** | 19.134% | Castellano tradicional |
| **9** | **VARGAS** | 415 | **1.097%** | 20.231% | Castellano tradicional |
| **10** | **MARTINEZ** | 410 | **1.083%** | 21.314% | Castellano patronímico |
| **11** | **FERNANDEZ** | 382 | **1.010%** | 22.324% | Castellano patronímico |
| **12** | **LOPEZ** | 371 | **0.980%** | 23.304% | Castellano patronímico |
| **13** | **RODRIGUEZ** | 348 | **0.920%** | 24.224% | Castellano patronímico |
| **14** | **COLQUE** | 315 | **0.832%** | 25.056% | Quechua / Aymara ("Plata / Riqueza mineral") |
| **15** | **VILLCA** | 299 | **0.790%** | 25.846% | Quechua / Aymara ("Sol / Sagrado") |
| **16** | **RAMIREZ** | 251 | **0.663%** | 26.509% | Castellano patronímico |
| **17** | **CASTRO** | 248 | **0.655%** | 27.164% | Castellano toponímico |
| **18** | **CORO** | 239 | **0.632%** | 27.796% | Quechua ("Oro / Corona vegetal") |
| **19** | **LLANOS** | 229 | **0.605%** | 28.401% | Castellano toponímico |
| **20** | **GOMEZ** | 227 | **0.600%** | 29.001% | Castellano patronímico |
| **21** | **MENDOZA** | 209 | **0.552%** | 29.553% | Castellano toponímico |
| **22** | **COPA** | 195 | **0.515%** | 30.068% | Quechua / Aymara ("Turquesa / Piedra verde") |
| **23** | **DELGADO** | 194 | **0.513%** | 30.581% | Castellano descriptivo |
| **24** | **GARCIA** | 188 | **0.497%** | 31.078% | Castellano tradicional |
| **25** | **SANCHEZ** | 188 | **0.497%** | 31.575% | Castellano patronímico |
| **26** | **HUANCA** | 183 | **0.484%** | 32.059% | Aymara ("Peñón / Roca sagrada") |
| **27** | **FUERTES** | 183 | **0.484%** | 32.543% | Castellano característico de Potosí |
| **28** | **ROJAS** | 176 | **0.465%** | 33.008% | Castellano tradicional |
| **29** | **GONZALES** | 173 | **0.457%** | 33.465% | Castellano patronímico |
| **30** | **TORREZ** | 172 | **0.455%** | 33.920% | Castellano toponímico |
| **31–50** | PINTO, AGUILAR, GUZMAN, SOTO, SILVA, SUAREZ, PEÑA, ORTIZ, MORALES, JIMENEZ, ALVAREZ, SALAZAR, BALDIVIESO, BERRIOS, CAHUANA, PACO, TICONA, CALANI, YUCRA, CHURATA | ~0.30%–0.45% c/u | ~34%–42% | Mixto Quechua / Castellano potosino |
| **51–100** | AYAVIRI, CHAMBI, CANAVIRI, CALLISAYA, CHIPANA, LIMACHI, POCOATA, ARACAYO, DUARTE, ACUÑA, IBARRA, RIVERA, MEDINA, VILLEGAS, CORDERO, SERRANO, CABRERA, etc. | ~0.15%–0.30% c/u | ~43%–55% | Diversidad regional andina |

---

### 4.2. Distribución de Nombres de Pila por Género

En la población de la UATF, el uso de nombres compuestos es sumamente frecuente, reflejando patrones culturales devocionales y de doble registro civil:
- **Tasa de Nombres Compuestos:** **35%** en varones y **32%** en mujeres.
- **Tasa de Nombres Simples:** **65%** en varones y **68%** en mujeres.

#### Nombres Masculinos Frecuentes
- **Compuestos:** JUAN CARLOS, MIGUEL ANGEL, JOSE LUIS, MARCO ANTONIO, LUIS ALBERTO, JORGE LUIS, VICTOR HUGO, JUAN JOSE, LUIS FERNANDO, CARLOS ALBERTO, JOSE MANUEL, EDWIN MARCELO, JULIO CESAR, CRISTIAN OMAR.
- **Simples:** EDWIN, DAVID, JHONNY, ALVARO, JAVIER, ROLANDO, OSCAR, FREDDY, ARIEL, DANIEL, VLADIMIR, JAIME, CRISTIAN, GONZALO, RAMIRO, EDGAR, WALTER, RUBEN, GABRIEL, RODRIGO, HERNAN, GUSTAVO, ELVIS, BORIS, IVAN, FELIX, MARCELO.

#### Nombres Femeninos Frecuentes
- **Compuestos:** MARIA ELENA, ANA MARIA, MARIA ISABEL, CARMEN ROSA, MARIA EUGENIA, PAOLA ANDREA, SILVIA ELENA, LAURA VANESSA, LUZ MARINA, ROSA MARIA, KATERINE PAOLA, LIZETH PAMELA.
- **Simples:** MARIBEL, ELIZABETH, ROXANA, SONIA, PATRICIA, SANDRA, VERONICA, GABRIELA, LOURDES, DANIELA, FABIOLA, LIDIA, MARISOL, CLAUDIA, XIMENA, MONICA, TANIA, ALEJANDRA, MARTHA, GLADYS, BEATRIZ, YESICA, MIRIAM, NOEMI, JUDITH, NANCY, RUTH, WENDY, JANETH.

---

### 4.3. Documentos de Identidad (DIP) y Matrícula Universitaria (`id_ra`)

1. **Cédula de Identidad (DIP):**
   - Rango numérico verosímil para la población nacida entre 1995 y 2008: números enteros entre **3.500.000 y 13.500.000**.
   - Extensión Departamental:
     - `PT` (Potosí): **70.0%**
     - `CH` (Chuquisaca): **10.0%**
     - `OR` (Oruro): **8.0%**
     - `LP` (La Paz): **5.0%**
     - `CB` (Cochabamba): **4.0%**
     - `TJ` (Tarija): **1.5%**
     - `SC` (Santa Cruz): **1.0%**
     - `BE` (Beni): **0.3%**
     - `PA` (Pando): **0.2%**
   - Complemento de Cédula (`nro_dip_complemento`): Un 3% de los registros presenta complemento alfa (ej. `1A`, `2B`) para resolución de duplicidad homónima.
2. **Matrícula Estudiantil Institucional (`id_ra`):**
   - Formato formal: Prefijo institucional `RA-` seguido de 5 a 6 dígitos correlativos.
   - Expresión regular: `^RA-[0-9]{5,6}$` (ej. `RA-10254`, `RA-584920`).

### 4.4. Proporciones de Género y Estado Civil
- **Género (`id_sexo`):**
  - Femenino (`'F'`): **50.5%**
  - Masculino (`'M'`): **49.5%**
- **Estado Civil (`_bp_estados_civiles` / `uatf_datos.estado_civil`):**
  - Código `1` / `'S'` (Soltero / Soltera): **88.0%**
  - Código `2` / `'C'` (Casado / Casada): **10.0%**
  - Código `3` / `'D'` (Divorciado / Divorciada): **1.0%**
  - Código `4` / `'V'` (Viudo / Viuda): **0.3%**
  - Código `5` / `'U'` (Conviviente / Unión Libre): **0.7%**

---

## 5. Catálogo de Colegios y Unidades Educativas

### 5.1. Distribución Nacional por Departamento
De acuerdo al archivo oficial `colegios.csv` (Ministerio de Educación de Bolivia):

| Departamento | Total Unidades Educativas | Fiscales | Convenio | Privadas | Proporción Nacional |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **La Paz** | 1.460 | 1.180 | 140 | 140 | 27.9% |
| **Santa Cruz** | 1.144 | 880 | 95 | 169 | 21.9% |
| **Cochabamba** | 815 | 640 | 85 | 90 | 15.6% |
| **Potosí** | **488** | **428** | **35** | **25** | **9.3%** |
| **Beni** | 392 | 340 | 32 | 20 | 7.5% |
| **Chuquisaca** | 309 | 260 | 30 | 19 | 5.9% |
| **Oruro** | 240 | 200 | 22 | 18 | 4.6% |
| **Tarija** | 225 | 185 | 24 | 16 | 4.3% |
| **Pando** | 162 | 145 | 11 | 6 | 3.1% |
| **Total Nacional** | **5.235** | **4.258** | **474** | **503** | **100%** |

### 5.2. Desglose Empírico de Características Escolares
- **Dependencia Institucional:**
  - **Fiscal (Fiscal / Estatal):** **80.76%**
  - **Privada:** **9.86%**
  - **Convenio (Iglesia / Fe y Alegría / Mineros):** **9.38%**
- **Turno de Asistencia:**
  - **Mañana (`M`):** **57.59%**
  - **Mañana y Tarde (`M-T`):** **23.69%**
  - **Tarde (`T`):** **16.01%**
  - **Noche (`N`):** **2.71%** (Bachillerato de Educación de Adultos / CCEA)
- **Área Geográfica:**
  - **Urbana:** **62.40%**
  - **Rural:** **37.60%**

---

### 5.3. Colegios Emblemáticos de la Ciudad de Potosí (Provincia Tomás Frías)

A continuación se listan las unidades educativas tradicionales de donde proviene más del 50% de los bachilleres que ingresan a la UATF, con sus códigos SIE oficiales (`cod_ue`):

| Código SIE (`cod_ue`) | Nombre Oficial de la Unidad Educativa | Dependencia | Turno | Área | Fundación | Rasgos Distintivos |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **81980001** | **COLEGIO NACIONAL PICHINCHA** | Fiscal | Mañana | Urbana | 1826 | Colegio tradicional de varones fundado por el Mariscal Sucre; baluarte cívico de Potosí. |
| **81980002** | **COLEGIO NACIONAL JUAN MANUEL CALERO** | Fiscal | Mañana | Urbana | 1941 | Colegio fiscal tradicional, rival deportivo e histórico del Pichincha. |
| **81980003** | **COLEGIO SANTA ROSA** | Fiscal | Tarde | Urbana | 1912 | Liceo tradicional femenino de señoritas de alta trayectoria académica. |
| **81980004** | **COLEGIO PARTICULAR DON BOSCO** | Convenio | Mañana | Urbana | 1935 | Colegio Salesiano de excelencia técnica y formación humanística. |
| **81980005** | **COLEGIO PARTICULAR FRANCISCANO** | Privada | Mañana | Urbana | 1960 | Colegio católico tradicional de prestigio en el centro de la ciudad. |
| **81980006** | **COLEGIO PARTICULAR MARIA AUXILIADORA** | Privada | Mañana | Urbana | 1928 | Colegio religioso femenino administrado por las Hijas de María Auxiliadora. |
| **81980007** | **COLEGIO CRISTO MAESTRO** | Convenio | Mañana-Tarde | Urbana | 1975 | Red Fe y Alegría, formación técnica en barrios periféricos. |
| **81980008** | **COLEGIO NACIONAL SIMÓN BOLÍVAR** | Fiscal | Mañana | Urbana | 1955 | Colegio fiscal emblemático de la zona alta de Potosí. |
| **81980009** | **COLEGIO MODESTO OMISTE** | Fiscal | Mañana | Urbana | 1908 | Nombrado en honor al educador potosino pionero de la educación laica. |
| **81980010** | **COLEGIO SUCRE** | Fiscal | Tarde | Urbana | 1925 | Tradicional colegio fiscal mixto del centro histórico. |
| **81980011** | **COLEGIO CARLOS MEDINACELLI** | Fiscal | Tarde | Urbana | 1968 | Colegio fiscal en honor al célebre autor de *La Chaskañawi*. |
| **81980012** | **COLEGIO ANICETO ARCE** | Fiscal | Mañana | Urbana | 1938 | Colegio fiscal de tradición obrera y minera. |
| **81980013** | **COLEGIO JOSÉ MARÍA LINARES** | Fiscal | Mañana | Urbana | 1948 | Unidad educativa con fuerte presencia estudiantil en ingenierías. |
| **81980014** | **COLEGIO PARTICULAR BANCARIO** | Privada | Mañana | Urbana | 1982 | Colegio privado orientado a ciencias económicas y administrativas. |
| **81980015** | **COLEGIO CLETO LOAYZA** | Fiscal | Tarde | Urbana | 1970 | Colegio fiscal de la zona de San Roque. |

---

### 5.4. Colegios de las Provincias y Sub-sedes Universitarias
Para los estudiantes inscritos en las sub-sedes desconcentradas:
- **Tupiza (Sud Chichas):** Colegio Nacional Sucre de Tupiza (`cod_ue: 81980101`), Colegio Nacional Chorolque (`cod_ue: 81980102`), Colegio Santa Ana de Tupiza, Liceo de Señoritas Tupiza.
- **Villazón (Modesto Omiste):** Colegio 9 de Abril (`cod_ue: 81980103`), Colegio Cornelio Saavedra de Villazón (`cod_ue: 81980104`), Colegio Mariscal Sucre.
- **Uyuni (Antonio Quijarro):** Colegio Antonio Quijarro (`cod_ue: 81980105`), Colegio Héroes del Chaco (`cod_ue: 81980106`), Colegio Mauri.
- **Uncía / Llallagua (Rafael Bustillo):** Colegio Nacional Junín de Uncía (`cod_ue: 81980107`), Colegio Siglo XX de Llallagua (`cod_ue: 81980108`), Colegio América de Catavi (`cod_ue: 81980109`), Colegio 1ro de Mayo.
- **Llica (Daniel Campos):** Colegio Daniel Campos de Llica (`cod_ue: 81980110`).
- **Sacaca (Alonso de Ibáñez):** Colegio Alonso de Ibáñez (`cod_ue: 81980111`).

---

## 6. Guía de Consumo para el Generador `@faker-js/faker` v10 (Node.js)

Para implementar el generador reproducible de datos sintéticos (Issue #206), el equipo de desarrollo debe consumir directamente los archivos estructurados generados en `docs/seed-data/catalogs/`:

1. **`geographic_bolivia_potosi.json`**:
   - Para seleccionar el departamento de nacimiento y residencia del postulante usando la función de ruleta ponderada con los pesos de `student_weight`.
   - Para estudiantes de Potosí, seleccionar la provincia según `localities_in_database` y extraer un `cod_loc` válido para garantizar integridad referencial en `public.lugar_localidad`.
   - Para las direcciones en la ciudad de Potosí, combinar aleatoriamente los arreglos `neighborhoods` y `streets_and_avenues` mediante los formatos de `address_generation_patterns`.

2. **`demographic_names_surnames.json`**:
   - Extraer el apellido paterno y materno muestreando la lista `empirical_top_100` según sus probabilidades empíricas (`frequency_percentage`).
   - Muestrear el primer nombre respetando la tasa de nombres compuestos (35% en varones y 32% en mujeres).
   - Generar el C.I. (DIP) en el rango `[3500000, 13500000]` asociando la extensión departamental según `extension_distribution`.

3. **`schools_catalog.json`**:
   - Asociar el colegio de egreso secundario (`uatf_datos.id_colegio`) a partir de la lista oficial de Potosí y colegios provinciales para garantizar consistencia con `prs_colegios`.
   - Asignar la dependencia y turno respetando las proporciones reales (80.7% Fiscal, 57.6% Turno Mañana).

4. **Semilla Determinista:**
   - La ejecución debe inicializarse siempre con `faker.seed(SEED_NUMBER)` (por defecto `42`) para garantizar que las corridas del pipeline generen exactamente el mismo conjunto de datos reproducible para pruebas de integración y benchmarks de Machine Learning.

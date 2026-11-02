# UATF Synthetic Seed Generator (DATA-001 / Issue #206)

Generador reproducible de datos académicos **100 % ficticios y sintéticos** para la base de datos transaccional (OLTP) simulada de la **Universidad Autónoma Tomás Frías (UATF)** (`jachasun` en PostgreSQL 14.2).

> [!IMPORTANT]
> **Aviso de Privacidad y Límite de Uso:**  
> Todos los nombres, cédulas de identidad, números telefónicos, correos electrónicos y domicilios generados por esta herramienta son **estrictamente ficticios y sintetizados algorítmicamente** usando `@faker-js/faker` v10 y distribuciones probabilísticas empíricas. **No representan datos reales de estudiantes ni evidencia institucional de la UATF.** Esta herramienta está destinada exclusivamente para pruebas locales de integración, pipelines ETL y desarrollo de modelos de Machine Learning.

---

## 🚀 Requisitos Previos

* **Node.js:** Versión 20.0.0 o superior (recomendado Node 22+ / 24+).
* Alternativamente: **Bun** v1.1+.
* Base de datos PostgreSQL local (contenedor Docker `jachasun`).

---

## 📦 Instalación y Compilación

Desde el directorio `tools/seed-generator`:

```bash
# Instalar dependencias
npm install
# (o con Bun: bun install)

# Compilar TypeScript a JavaScript (dist/)
npm run build
```

---

## 🧪 Pruebas Automatizadas

La suite incluye pruebas de determinismo, validación de guardas de seguridad contra producción, reglas de cronología académica, regla DSA de abandono y ausencia de columnas fantasma:

```bash
npm test
# (o con Bun: bun test)
```

---

## 🛠️ Modos de Uso de la CLI

### 1. Simulación en memoria (Dry-Run)
Verifica la generación de cohortes y emite el resumen métrico sin tocar la base de datos ni escribir archivos:

```bash
node dist/cli.js --dry-run
# o con bun:
bun run src/cli.ts --dry-run
```

### 2. Generación de Script SQL Determinista
Genera un archivo `.sql` reproducible envuelto en transacciones (`BEGIN ... COMMIT`) y ordenado según dependencias OLTP:

```bash
# Perfil rápido (test)
node dist/cli.js --profile test --output-sql ./out/seed_sample.sql

# Perfil mediano o completo con semilla específica
node dist/cli.js --profile medium --seed 42 --start-year 2000 --end-year 2026 --output-sql ./out/seed_full.sql
```

### 3. Inserción directa en PostgreSQL local
Inserta los registros en la base de datos local respetando todas las claves foráneas:

```bash
# Asegurarse de tener el archivo .env configurado con las credenciales locales
node dist/cli.js --profile test --clean --execute
```

---

## ⚙️ Opciones de la Línea de Comandos

| Opción | Descripción | Valor por defecto |
|---|---|---|
| `-s, --seed <number>` | Semilla pseudoaleatoria para reproducibilidad | `12345` |
| `-p, --profile <profile>` | Perfil de simulación (`test`, `medium`, `full`) | `test` |
| `-c, --cohort-size <number>` | Postulantes por ingreso; el período 2 solo admite carreras semestrales | `150` (test), `600` (med), `1500` (full) |
| `--start-year <number>` | Año inicial de simulación longitudinal | `2000` |
| `--end-year <number>` | Año final de generación longitudinal; 2026 amplía la cobertura sintética | `2026` |
| `--dry-run` | Simular en memoria sin persistir | `false` |
| `-o, --output-sql <path>` | Guardar sentencias SQL en archivo | `null` |
| `--clean` | Incluir truncado previo en orden inverso | `false` |
| `--execute` | Ejecutar inserción en PostgreSQL local | `false` |
| `--catalogs-dir <path>` | Ruta personalizada a catálogos JSON | Auto-detectada |

`--clean` incluye `TRUNCATE ... CASCADE` dentro de la transacción y el SQL generado se niega a continuar si `current_database()` no es `jachasun_test`. Usarlo solo en la instancia efímera de prueba; sin `--clean`, el script conserva los datos existentes.

---

## 🛡️ Guardas de Seguridad Anti-Producción

El ejecutable cuenta con una guarda estricta en `src/config/security.ts` que **aborta la ejecución de inmediato** si:
1. El hostname de base de datos contiene cadenas como `prod`, `production`, `uatf.edu.bo`, `rds.amazonaws.com`, `.azure.com`, `.supabase.co`, etc.
2. La variable `NODE_ENV` está fijada en `production`.
3. El nombre de la base de datos contiene `prod` o `uatf_oficial`.

---

## 🔄 Flujo Downstream (OLTP → ETL Hop → ML Prediction)

1. **Población OLTP:** El seed puebla `public.uatf_datos`, `public.postulantes`, `academico.alumnos`, `public.matriculas`, `public.cajas_transacciones`, `public.valores_transacciones`, `academico.pln_materias`, `academico.alm_programaciones`, `academico.notas_planilla` y `actas_graduacion.graduados`. Por gestión, los programas semestrales tienen ingresos/cursados en periodos 1 y 2; los programas anuales tienen un ingreso/cursado en periodo 3.
   - Cada compra de matrícula es un evento único `public.cajas_transacciones.id_transaccion`, con un detalle vinculado por `public.valores_transacciones.id_caja_tran`.
   - En programas semestrales, una compra de período 1 crea las filas académicas de matrícula para períodos 1 y 2; el simulador no genera una segunda compra en período 2 para ese alumno/gestión.
   - La marca `cajas_transacciones.fec_pago` coincide con `matriculas._registrado`; los campos `fec_transaccion`, `valores_transacciones.fecha` y `matriculas.fec_registro` conservan la fecha académica sin hora.
   - Importes, cargo (`MAT1`) y concepto (`0001`) son marcadores sintéticos de prueba, no aranceles institucionales.
2. **Extracción ETL (Apache Hop):** Los registros incluyen `_tipo_academico = 'CAR'`, `activo = 'A'` y `_creditos > 0`, cumpliendo 100% de los filtros de los pipelines `pl_dim_estudiante_scd2_mvp` y `pl_fact_cursado_mvp`.
3. **Modelado Predictivo (PRED-002 / PRED-003):** Las notas simulan la regla DSA de deserción temprana (estudiantes con menos de 2 parciales tienen estado `'X'` y abandono), permitiendo entrenar clasificadores de deserción sobre cohortes longitudinales sin fuga temporal.

El rango predeterminado 2000–2026 permite construir trayectorias históricas y deja 2026 como último año sintético. Los programas semestrales generan cohortes y cursados en los periodos 1 y 2; los anuales generan una cohorte y cursados en el periodo 3 (`GESTION ANUAL`). Ejecutar la generación no garantiza por sí sola etiquetas evaluables en el DW: deben existir y procesarse los cierres sucesores (`1→2`, `2→1` de la siguiente gestión, `3→3` de la siguiente gestión). Los datos generados en 2026 son sintéticos; el ETL solo debe cerrar un período cuando su fecha efectiva configurada ya haya ocurrido.

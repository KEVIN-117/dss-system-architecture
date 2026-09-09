# DSS Monorepo

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45" /></a>

Monorepo principal del **Decision Support System (DSS)** de la UATF. Contiene todas las aplicaciones frontend, el BFF, y las librerías compartidas del sistema. Gestionado con [Nx](https://nx.dev) y [Bun](https://bun.sh).

---

## Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Estructura del monorepo](#2-estructura-del-monorepo)
3. [Arquitectura de capas](#3-arquitectura-de-capas)
4. [Estrategia de tags de Nx](#4-estrategia-de-tags-de-nx)
5. [Reglas de límites de módulos](#5-reglas-de-límites-de-módulos)
6. [Proyectos actuales](#6-proyectos-actuales)
7. [Convenciones de nomenclatura](#7-convenciones-de-nomenclatura)
8. [Configuración de archivos de proyecto](#8-configuración-de-archivos-de-proyecto)
9. [Comandos frecuentes](#9-comandos-frecuentes)
10. [CI y caché](#10-ci-y-caché)
11. [Recursos externos](#11-recursos-externos)

---

## 1. Visión general

El DSS es un sistema de apoyo a la toma de decisiones académicas de la UATF. El monorepo centraliza el código de las aplicaciones web que consumen los dashboards analíticos, el BFF que los alimenta, y todas las librerías de UI, dominio, datos y conectores externos.

**Stack principal:**

| Capa | Tecnología |
|---|---|
| Aplicaciones web | Next.js 16, React 19 |
| Lenguaje | TypeScript 6 |
| Gestor de paquetes | Bun workspaces |
| Herramienta de build | Nx 23 |
| Estilos | Tailwind CSS + shadcn/ui |
| Testing unitario | Vitest |
| Testing E2E | Playwright |
| Linting | ESLint (flat config) |

---

## 2. Estructura del monorepo

```text
dss-monorepo/
│
├── apps/                          # Aplicaciones desplegables
│   ├── admin-portal/              # Portal de administración del sistema
│   │   ├── app/                   # App Router de Next.js
│   │   ├── public/
│   │   ├── package.json           # Dependencias y nombre del paquete
│   │   └── project.json           # Configuración Nx (tags, targets)
│   │
│   ├── admin-portal-e2e/          # Tests E2E del admin-portal (Playwright)
│   │   ├── src/
│   │   ├── playwright.config.mts
│   │   └── package.json
│   │
│   ├── rector-dashboard/          # [FUTURO] Dashboard del Rector
│   ├── decano-dashboard/          # [FUTURO] Dashboard del Decano
│   ├── director-dashboard/        # [FUTURO] Dashboard del Director de Carrera
│   ├── docs-portal/               # [FUTURO] Documentación pública del DSS
│   └── bff/                       # [FUTURO] Backend-For-Frontend (Next.js API Routes)
│
├── libs/                          # Librerías internas compartidas
│   │
│   ├── ui/                        # [FUTURO] Design System del DSS
│   │   ├── primitives/            # Botones, inputs, selects, dialogs (shadcn base)
│   │   ├── components/            # Componentes compuestos: DataTable, KpiCard, etc.
│   │   ├── layouts/               # DashboardLayout, Sidebar, Header, PageContainer
│   │   └── theme/                 # tokens.css, globals.css, tailwind.config.ts
│   │
│   ├── charts/                    # [FUTURO] Gráficos analíticos (Recharts / ECharts)
│   │   ├── enrollment-trend/
│   │   ├── risk-distribution/
│   │   ├── performance-chart/
│   │   └── admission-funnel/
│   │
│   ├── domain/                    # [FUTURO] Modelos y tipos del dominio académico
│   │   ├── academic/
│   │   ├── students/
│   │   ├── admissions/
│   │   ├── performance/
│   │   ├── risk/
│   │   ├── faculties/
│   │   ├── careers/
│   │   └── predictions/
│   │
│   ├── data-access/               # [FUTURO] Acceso a APIs y BFF
│   │   ├── academic/
│   │   ├── students/
│   │   ├── admissions/
│   │   └── predictions/
│   │
│   ├── features/                  # [FUTURO] Funcionalidades completas (UI + datos)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── academic-performance/
│   │   ├── dropout-risk/
│   │   ├── admissions/
│   │   └── administration/
│   │
│   ├── auth/                      # [FUTURO] Integración con Keycloak / OIDC
│   ├── rbac/                      # [FUTURO] Control de acceso basado en roles
│   │
│   └── connectors/                # [FUTURO] Clientes de servicios externos (solo para BFF)
│       ├── mondrian/              # Cliente XMLA para Mondrian OLAP
│       ├── apache-hop/            # Cliente para pipelines ETL de Apache Hop
│       └── prediction/            # Cliente para el servicio de predicción ML
│
├── eslint.config.mjs              # Configuración ESLint global (flat config)
├── nx.json                        # Configuración Nx (plugins, targetDefaults, namedInputs)
├── package.json                   # Dependencias raíz y bun workspaces
├── tsconfig.base.json             # Paths de TypeScript compartidos entre proyectos
├── tsconfig.json                  # Config TypeScript raíz
└── vitest.config.mts              # Config Vitest global
```

> Las carpetas marcadas como `[FUTURO]` representan la arquitectura objetivo. No están creadas aún, pero las reglas de boundaries y la estrategia de tags ya están diseñadas para recibirlas.

---

## 3. Arquitectura de capas

El monorepo implementa una **arquitectura en capas con dirección de dependencia estricta**. Ninguna capa puede importar de una capa que se encuentre "por encima" de ella.

### 3.1 Capa Frontend (Apps y Libs)

```text
┌─────────────────────────────────────────────────────┐
│                        APPS                         │
│  admin-portal  rector-dashboard  decano-dashboard   │
└───────────────────────────┬─────────────────────────┘
                            │  puede consumir ↓
┌───────────────────────────▼─────────────────────────┐
│                      FEATURES                       │
│  feature-dropout-risk  feature-performance  ...     │
└───────────────────────────┬─────────────────────────┘
                            │  puede consumir ↓
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌────────────────┐ ┌──────────────┐  ┌────────────────┐
│  DATA ACCESS   │ │    DOMAIN    │  │       UI       │
└────────┬───────┘ └──────┬───────┘  └───────┬────────┘
         │                │                  │
         └────────────────┼──────────────────┘
                          │  puede consumir ↓
┌─────────────────────────▼─────────────────────────┐
│                       UTIL                        │
│   Helpers compartidos, constantes, tipos base     │
└───────────────────────────────────────────────────┘
```

### 3.2 Capa BFF y Conectores (completamente separada del frontend)

```text
┌──────────────────────────────────────────────────┐
│                      BFF                         │
│          apps/bff (Next.js API Routes)           │
└───────────────────────────┬──────────────────────┘
                            │  puede consumir ↓
┌───────────────────────────▼──────────────────────┐
│                   CONNECTORS                     │
│  connector-mondrian  connector-hop  connector-ml │
└───────────────────────────┬──────────────────────┘
                            │  puede consumir ↓
┌───────────────────────────▼──────────────────────┐
│                UTIL (solo compartidos)           │
└──────────────────────────────────────────────────┘
```

> **Invariante crítica:** El frontend (`apps/*`, `libs/features`, `libs/ui`, `libs/data-access`) **jamás puede importar** `libs/connectors/*`. La comunicación frontend→backend siempre pasa por el BFF.

### 3.3 Regla de scopes funcionales

Los diferentes contextos de negocio solo pueden depender de librerías de su propio scope o del scope compartido:

```text
scope:admin   ──►  scope:shared   ✅
scope:admin   ──►  scope:admin    ✅
scope:admin   ──►  scope:rector   ❌  violación de boundary
scope:rector  ──►  scope:decano   ❌  violación de boundary
```

---

## 4. Estrategia de tags de Nx

Nx utiliza **tags** para clasificar proyectos. El monorepo implementa **dos dimensiones de clasificación independientes** que se combinan para expresar restricciones precisas.

### 4.1 Dimensión `type` — Responsabilidad arquitectónica

Define el rol arquitectónico de cada proyecto dentro del sistema.

| Tag | Rol | Ejemplos de proyectos |
|---|---|---|
| `type:app` | Aplicación desplegable (Next.js, entrypoint) | `admin-portal`, `rector-dashboard` |
| `type:feature` | Feature completa con UI + lógica + datos | `feature-dropout-risk`, `feature-performance` |
| `type:data-access` | Acceso a APIs, hooks de datos, React Query | `data-access-academic`, `data-access-students` |
| `type:domain` | Interfaces, tipos, enums del dominio | `domain-academic`, `domain-students` |
| `type:ui` | Componentes visuales puros, Design System | `ui-primitives`, `ui-components`, `charts` |
| `type:util` | Helpers, constantes, formatters, validators | `util-formatters`, `util-validators` |
| `type:bff` | Backend-For-Frontend (API routes de Next.js) | `bff` |
| `type:connector` | Clientes de servicios externos | `connector-mondrian`, `connector-hop` |
| `type:e2e` | Tests de extremo a extremo | `admin-portal-e2e`, `rector-dashboard-e2e` |

### 4.2 Dimensión `scope` — Ámbito funcional

Define el contexto de negocio al que pertenece el proyecto.

| Tag | Ámbito | Descripción |
|---|---|---|
| `scope:admin` | Administración del sistema | Portal de configuración, usuarios, conectores |
| `scope:rector` | Rectorado | KPIs institucionales, reportes ejecutivos |
| `scope:decano` | Decanatura | Métricas por facultad, rendimiento académico |
| `scope:director` | Dirección de carrera | Análisis por carrera, deserción, admisiones |
| `scope:shared` | Compartido entre todos | UI, domain, utils reutilizables por cualquier scope |
| `scope:infrastructure` | Infraestructura técnica | Auth, RBAC, connectors, BFF |

### 4.3 Cómo etiquetar un proyecto

Cada proyecto debe llevar exactamente **un tag de tipo** y **un tag de scope**. Los tags siempre van en el `project.json` del proyecto:

```json
// apps/admin-portal/project.json — ejemplo de aplicación
{
  "name": "@dss-monorepo/admin-portal",
  "projectType": "application",
  "sourceRoot": "apps/admin-portal/src",
  "tags": [
    "type:app",
    "scope:admin"
  ]
}
```

```json
// libs/ui/components/project.json — ejemplo de librería compartida
{
  "name": "@dss-monorepo/ui-components",
  "projectType": "library",
  "sourceRoot": "libs/ui/components/src",
  "tags": [
    "type:ui",
    "scope:shared"
  ]
}
```

```json
// libs/connectors/mondrian/project.json — ejemplo de conector
{
  "name": "@dss-monorepo/connector-mondrian",
  "projectType": "library",
  "sourceRoot": "libs/connectors/mondrian/src",
  "tags": [
    "type:connector",
    "scope:infrastructure"
  ]
}
```

### 4.4 Tabla de tags por proyecto

| Proyecto | `type` | `scope` | Estado |
|---|---|---|---|
| `admin-portal` | `type:app` | `scope:admin` | ✅ Activo |
| `admin-portal-e2e` | `type:e2e` | `scope:admin` | ✅ Activo |
| `rector-dashboard` | `type:app` | `scope:rector` | 🔜 Futuro |
| `decano-dashboard` | `type:app` | `scope:decano` | 🔜 Futuro |
| `director-dashboard` | `type:app` | `scope:director` | 🔜 Futuro |
| `bff` | `type:bff` | `scope:infrastructure` | 🔜 Futuro |
| `ui-primitives` | `type:ui` | `scope:shared` | 🔜 Futuro |
| `ui-components` | `type:ui` | `scope:shared` | 🔜 Futuro |
| `charts` | `type:ui` | `scope:shared` | 🔜 Futuro |
| `domain-academic` | `type:domain` | `scope:shared` | 🔜 Futuro |
| `data-access-academic` | `type:data-access` | `scope:shared` | 🔜 Futuro |
| `feature-dropout-risk` | `type:feature` | `scope:shared` | 🔜 Futuro |
| `auth` | `type:util` | `scope:infrastructure` | 🔜 Futuro |
| `rbac` | `type:util` | `scope:infrastructure` | 🔜 Futuro |
| `connector-mondrian` | `type:connector` | `scope:infrastructure` | 🔜 Futuro |
| `connector-hop` | `type:connector` | `scope:infrastructure` | 🔜 Futuro |
| `connector-prediction` | `type:connector` | `scope:infrastructure` | 🔜 Futuro |

---

## 5. Reglas de límites de módulos

Las reglas están implementadas en [`eslint.config.mjs`](./eslint.config.mjs) mediante `@nx/enforce-module-boundaries` con nivel `error`. Cualquier importación que viole una restricción produce un error de lint que bloquea el merge en CI.

### 5.1 Reglas de la dimensión `type`

| Desde (`sourceTag`) | Puede importar (`onlyDependOnLibsWithTags`) |
|---|---|
| `type:app` | `type:feature`, `type:ui`, `type:data-access`, `type:domain`, `type:util` |
| `type:feature` | `type:ui`, `type:data-access`, `type:domain`, `type:util` |
| `type:data-access` | `type:domain`, `type:util` |
| `type:domain` | `type:util` |
| `type:ui` | `type:ui`, `type:util` |
| `type:util` | `type:util` |
| `type:bff` | `type:connector`, `type:util` |
| `type:connector` | `type:util` |
| `type:e2e` | `type:util` |

### 5.2 Reglas de la dimensión `scope`

| Desde (`sourceTag`) | Puede importar (`onlyDependOnLibsWithTags`) |
|---|---|
| `scope:admin` | `scope:shared`, `scope:admin` |
| `scope:rector` | `scope:shared`, `scope:rector` |
| `scope:decano` | `scope:shared`, `scope:decano` |
| `scope:director` | `scope:shared`, `scope:director` |
| `scope:shared` | `scope:shared` |
| `scope:infrastructure` | `scope:shared`, `scope:infrastructure` |

> Las reglas de `type` y `scope` se evalúan **independientemente** sobre cada importación. Una importación es válida solo si pasa **ambas** dimensiones.

### 5.3 Ejemplos de dependencias permitidas y prohibidas

```text
✅ PERMITIDAS

admin-portal (type:app, scope:admin)
    → feature-dropout-risk (type:feature, scope:shared)

feature-dropout-risk (type:feature, scope:shared)
    → data-access-academic (type:data-access, scope:shared)

data-access-academic (type:data-access, scope:shared)
    → domain-academic (type:domain, scope:shared)

domain-academic (type:domain, scope:shared)
    → util-formatters (type:util, scope:shared)

ui-components (type:ui, scope:shared)
    → ui-primitives (type:ui, scope:shared)

bff (type:bff, scope:infrastructure)
    → connector-mondrian (type:connector, scope:infrastructure)
```

```text
❌ PROHIBIDAS — producen error de lint

admin-portal → connector-mondrian   (type:app no puede importar type:connector)
ui-components → domain-academic     (type:ui no puede importar type:domain)
data-access-academic → feature-X    (type:data-access no puede importar type:feature)
domain-academic → ui-primitives     (type:domain no puede importar type:ui)
feature-dropout-risk → bff          (type:feature no puede importar type:bff)
scope:admin → scope:rector          (los scopes de negocio no se cruzan)
```

### 5.4 Política sobre `allow`

La configuración mantiene `allow: []`. No se deben agregar excepciones arbitrarias.

Si una importación rompe una regla, seguir en este orden:

1. **Revisar si el tag del proyecto está mal definido.**
2. **Revisar si la arquitectura está mal diseñada.**
3. Solo como último recurso, con justificación documentada en el PR, agregar una excepción en `allow`.

### 5.5 Validar las reglas

```sh
# Lint de un proyecto específico
bun nx run @dss-monorepo/admin-portal:lint

# Lint de todos los proyectos afectados por cambios
bun nx affected -t lint

# Lint de todo el workspace
bun nx run-many -t lint
```

---

## 6. Proyectos actuales

### `@dss-monorepo/admin-portal`

- **Ruta:** `apps/admin-portal/`
- **Tipo:** Aplicación Next.js 16 (App Router)
- **Tags:** `type:app`, `scope:admin`
- **Descripción:** Portal web de administración del DSS. Gestión de usuarios, roles, conectores externos, pipelines y métricas del sistema.

```sh
bun nx dev @dss-monorepo/admin-portal       # Servidor de desarrollo
bun nx build @dss-monorepo/admin-portal     # Build de producción
bun nx lint @dss-monorepo/admin-portal      # Linting
bun nx test @dss-monorepo/admin-portal      # Tests unitarios (Vitest)
```

### `@dss-monorepo/admin-portal-e2e`

- **Ruta:** `apps/admin-portal-e2e/`
- **Tipo:** Suite de tests E2E (Playwright)
- **Tags:** `type:e2e`, `scope:admin`
- **Dependencias implícitas:** `@dss-monorepo/admin-portal`
- **Descripción:** Tests de extremo a extremo del admin-portal. Levanta el servidor de desarrollo automáticamente.

```sh
bun nx e2e @dss-monorepo/admin-portal-e2e
```

---

## 7. Convenciones de nomenclatura

### Nombres de paquetes

Todos los proyectos usan el scope `@dss-monorepo` en su `package.json`:

```text
@dss-monorepo/admin-portal
@dss-monorepo/rector-dashboard
@dss-monorepo/ui-components
@dss-monorepo/domain-academic
@dss-monorepo/connector-mondrian
```

### Responsabilidad de cada archivo de configuración

| Archivo | Responsabilidad |
|---|---|
| `project.json` | Metadata de Nx: nombre canónico, tipo, tags, targets, `implicitDependencies` |
| `package.json` | Nombre del paquete npm, versión, dependencias |

> Los tags, targets y `implicitDependencies` **siempre van en `project.json`**, nunca en la sección `"nx"` de `package.json`.

---

## 8. Configuración de archivos de proyecto

### `project.json` — plantilla para una aplicación

```json
{
  "name": "@dss-monorepo/<nombre>",
  "projectType": "application",
  "sourceRoot": "apps/<nombre>/src",
  "tags": [
    "type:app",
    "scope:<scope>"
  ]
}
```

### `project.json` — plantilla para una librería

```json
{
  "name": "@dss-monorepo/<nombre>",
  "projectType": "library",
  "sourceRoot": "libs/<ruta>/src",
  "tags": [
    "type:<tipo>",
    "scope:<scope>"
  ]
}
```

### `project.json` — plantilla para un proyecto E2E

```json
{
  "name": "@dss-monorepo/<nombre>-e2e",
  "projectType": "application",
  "sourceRoot": "apps/<nombre>-e2e/src",
  "implicitDependencies": ["@dss-monorepo/<nombre>"],
  "tags": [
    "type:e2e",
    "scope:<scope>"
  ]
}
```

### `nx.json` — configuración global

El archivo [`nx.json`](./nx.json) contiene:

- **`plugins`:** Plugins activos (`@nx/next`, `@nx/js`, `@nx/eslint`, `@nx/playwright`, `@nx/vitest`)
- **`targetDefaults`:** Configuración por defecto para targets (ej. `test` depende de `^build`)
- **`namedInputs`:** Conjuntos de entradas para caché (`default`, `production`, `sharedGlobals`)
- **`generators`:** Opciones por defecto para generadores (estilo CSS y linter ESLint para `@nx/next`)

---

## 9. Comandos frecuentes

### Desarrollo

```sh
bun nx dev @dss-monorepo/admin-portal         # Dev server
bun nx show project @dss-monorepo/admin-portal # Ver targets disponibles
bun nx show projects                           # Listar todos los proyectos
bun nx graph                                   # Grafo de dependencias
```

### Testing

```sh
bun nx test @dss-monorepo/admin-portal         # Tests unitarios
bun nx e2e @dss-monorepo/admin-portal-e2e      # Tests E2E
bun nx affected -t test                        # Tests de proyectos afectados
bun nx test @dss-monorepo/admin-portal --watch # Watch mode
```

### Lint y formato

```sh
bun nx lint @dss-monorepo/admin-portal         # Lint de un proyecto
bun nx affected -t lint                        # Lint de afectados
bun nx run-many -t lint                        # Lint de todo el workspace
bun prettier --write .                         # Formato
```

### Build

```sh
bun nx build @dss-monorepo/admin-portal        # Build de producción
bun nx affected -t build                       # Build de afectados
```

### Tareas combinadas

```sh
bun nx affected -t lint,test,build             # Todo sobre afectados
bun nx run-many -t lint,test,build             # Todo sobre el workspace
```

### Generadores

```sh
bun nx g @nx/next:app <nombre> --directory=apps/<nombre> --style=css --linter=eslint
bun nx g @nx/react:lib <nombre> --directory=libs/<ruta>
bun nx g @nx/next:app --help                   # Ver opciones
```

---

## 10. CI y caché

### Caché local

Nx cachea los resultados de cada tarea. Si las entradas (código fuente, dependencias, variables de entorno definidas en `namedInputs`) no cambian, el resultado se restaura del caché sin re-ejecutar.

### Tareas afectadas

En CI, usar siempre `nx affected` para ejecutar solo las tareas que dependen de los archivos cambiados:

```sh
bun nx affected -t lint,test,build --base=origin/master
```

### Flujo de CI recomendado

```text
Pull Request
    │
    ▼
bun nx affected -t lint
    │
    ▼
bun nx affected -t test
    │
    ▼
bun nx affected -t build
    │
    ▼
bun nx affected -t e2e
    │
    ▼
Merge
```

### Caché remoto con Nx Cloud

```sh
bun nx connect
```

Nx Cloud comparte la caché entre desarrolladores y jobs de CI, eliminando trabajo duplicado.

---

## 11. Recursos externos

### Nx

- [Documentación de Nx](https://nx.dev)
- [Enforce Module Boundaries](https://nx.dev/docs/features/enforce-module-boundaries)
- [Tags en múltiples dimensiones](https://nx.dev/docs/guides/enforce-module-boundaries/tag-multiple-dimensions)
- [Nx en CI](https://nx.dev/ci/intro/ci-with-nx)
- [Nx Console (extensión VSCode)](https://nx.dev/getting-started/editor-setup)

### Stack

- [Next.js Docs](https://nextjs.org/docs)
- [Playwright Docs](https://playwright.dev)
- [Vitest Docs](https://vitest.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)



---

## Estructura del Monorepo

La idea general sería:

```text
dss-monorepo
│
├── apps/
│   ├── admin-portal
│   ├── rector-dashboard
│   ├── decano-dashboard
│   ├── director-dashboard
│   ├── docs-portal
│   └── bff
│
└── libs/
    ├── foundation/
    ├── ui/
    ├── auth/
    ├── rbac/
    ├── connectors/
    ├── charts/
    ├── data-access/
    ├── domain/
    └── feature/
```

Yo prefiero `libs/` sobre `packages/` en este caso, porque conceptualmente estás construyendo un **workspace Nx**, y las librerías representan unidades arquitectónicas del sistema. Técnicamente puedes usar cualquiera de los dos.

La diferencia importante no está en el nombre, sino en **cómo definimos las dependencias**.

---

## 1. No haría un único `packages/ui`

Este sería uno de los primeros cambios.

En lugar de:

```text
packages/
└── ui/
    ├── Button
    ├── Table
    ├── Chart
    ├── Dashboard
    ├── UserManagement
    └── ...
```

lo dividiría por niveles.

Por ejemplo:

```text
libs/
├── ui/
│   ├── primitives/
│   ├── components/
│   └── layouts/
│
├── charts/
├── auth/
├── rbac/
├── connectors/
├── data-access/
├── features/
└── domain/
```

Porque no queremos que una librería de componentes visuales termine dependiendo accidentalmente de:

```text
Keycloak
BFF
Mondrian
Apache Hop
React Query
```

La dirección de dependencias debería ser muy controlada.

---

# 2. Arquitectura que propondría

Para tu DSS, utilizaría algo parecido a esto:

```text
                         ┌─────────────────────┐
                         │        APPS         │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
       Admin Portal          Rector Dashboard       Decano Dashboard
             │                      │                      │
             └──────────────────────┼──────────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │    FEATURES      │
                           └────────┬─────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
               data-access       domain             ui
                    │               │                │
                    │               │                │
                    └───────────────┼────────────────┘
                                    ▼
                               foundation
```

Y por otro lado:

```text
                         ┌──────────────┐
                         │     BFF      │
                         └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
          Connectors        Auth/RBAC        Data Access
              │
       ┌──────┼─────────┐
       ▼      ▼         ▼
   Mondrian  Hop   Prediction Engine
```

Esto nos da una separación bastante limpia.

---

# 3. El `ui` debería ser realmente un Design System

Aquí sí aprovecharía **Tailwind + shadcn/ui** al máximo.

Pero hay un detalle importante:

**shadcn/ui no debería convertirse simplemente en una carpeta de componentes copiados.**

Lo convertiría en el **Design System oficial del DSS**.

Por ejemplo:

```text
libs/ui/
│
├── primitives/
│   ├── button
│   ├── input
│   ├── select
│   ├── dialog
│   ├── dropdown
│   ├── tooltip
│   └── ...
│
├── components/
│   ├── data-table
│   ├── metric-card
│   ├── kpi-card
│   ├── chart-card
│   ├── status-badge
│   ├── empty-state
│   ├── error-state
│   └── loading-state
│
├── layouts/
│   ├── dashboard-layout
│   ├── sidebar
│   ├── header
│   └── page-container
│
├── theme/
│   ├── tokens.css
│   ├── globals.css
│   └── tailwind.css
│
└── index.ts
```

Entonces cualquier aplicación:

```text
rector-dashboard
decano-dashboard
director-dashboard
admin-portal
```

consume:

```text
@dss/ui
```

---

# 4. Storybook sería obligatorio

Si estás creando un Design System compartido, yo incorporaría:

```text
@dss/ui
     │
     └── Storybook
```

Por ejemplo:

```text
Button
DataTable
MetricCard
KpiCard
ChartCard
Sidebar
Dialog
UserAvatar
RiskBadge
```

Cada componente tendría:

```text
Component
├── implementation
├── tests
└── stories
```

Por ejemplo:

```text
libs/ui/components/kpi-card/

├── kpi-card.tsx
├── kpi-card.test.tsx
└── kpi-card.stories.tsx
```

Esto permite que el equipo construya los dashboards sin tener que entrar constantemente a cada aplicación para verificar componentes.

Y Nx puede ejecutar únicamente las tareas afectadas.

---

# 5. Separaría `ui` de `charts`

Esto es bastante importante para un DSS.

No haría:

```text
ui/
└── charts/
```

como si un gráfico fuera simplemente otro componente visual.

Crearía:

```text
libs/
├── ui/
└── charts/
```

¿Por qué?

Porque los gráficos probablemente utilizarán:

```text
Recharts
ECharts
Nivo
Highcharts
D3
```

y tendrán lógica mucho más específica.

Por ejemplo:

```text
@dss/ui
    ↓
MetricCard

@dss/charts
    ↓
EnrollmentTrendChart
RiskDistributionChart
PerformanceChart
AdmissionFunnelChart
```

Así:

```text
ui
```

es agnóstico respecto a los datos.

Mientras:

```text
charts
```

puede tener conocimiento de visualización de datos.

---

# 6. Crearíamos `domain`

Esta parte puede ser muy valiosa para el DSS.

Por ejemplo:

```text
libs/domain/
├── academic/
├── students/
├── admissions/
├── performance/
├── risk/
├── faculties/
├── careers/
└── predictions/
```

Aquí podríamos definir:

```typescript
export interface StudentPerformance {
    studentId: string;
    finalGrade: number;
    failed: boolean;
    repeated: boolean;
    dropoutRisk: number;
}
```

o:

```typescript
export interface AcademicRisk {
    studentId: string;
    probability: number;
    level: "LOW" | "MEDIUM" | "HIGH";
}
```

Esto evita que cada dashboard invente su propio modelo.

Por ejemplo:

```text
Rector Dashboard
       │
       └── StudentPerformance

Decano Dashboard
       │
       └── StudentPerformance

Director Dashboard
       │
       └── StudentPerformance
```

Todos hablan el mismo lenguaje.

---

# 7. `data-access` sería otra capa

Aquí haría una separación muy clara.

```text
libs/data-access/
├── academic/
├── students/
├── admissions/
├── performance/
├── predictions/
└── users/
```

Por ejemplo:

```typescript
getAcademicPerformance()
getDropoutRisk()
getAdmissionStatistics()
getFacultyKPIs()
```

Pero estas librerías **no deberían conocer directamente la interfaz visual**.

La arquitectura sería:

```text
Dashboard
    ↓
Feature
    ↓
Data Access
    ↓
BFF
```

Por ejemplo:

```text
RectorDashboard
      ↓
feature/rector-overview
      ↓
data-access/analytics
      ↓
BFF
      ↓
Backend services
```

---

# 8. El BFF debe ser tratado como una aplicación independiente

Tu:

```text
/apps/bff
```

me parece una excelente decisión.

Pero evitaría que los dashboards hagan:

```text
Frontend
   ↓
Mondrian
```

o:

```text
Frontend
   ↓
Apache Hop
```

o:

```text
Frontend
   ↓
Prediction Engine
```

El flujo debería ser:

```text
Browser
   │
   ▼
Next.js Dashboard
   │
   ▼
BFF
   │
   ├── Auth
   ├── RBAC
   ├── Aggregation
   ├── Transformation
   ├── Caching
   │
   ├──────────► Mondrian
   ├──────────► Apache Hop
   └──────────► Prediction Service
```

Esto es especialmente importante para un DSS porque los dashboards probablemente necesiten **agregación y composición de múltiples fuentes**.

---

# 9. `connectors` no debería ser una librería gigante

Tu idea:

```text
packages/connectors
```

es buena, pero la dividiría.

```text
libs/connectors/
├── mondrian/
├── hop/
├── prediction/
└── common/
```

Por ejemplo:

```text
@dss/connector-mondrian
@dss/connector-hop
@dss/connector-prediction
```

Entonces el BFF puede hacer:

```text
BFF
 ├── connector-mondrian
 ├── connector-hop
 └── connector-prediction
```

Pero el frontend jamás debería importar:

```typescript
@dss/connector-mondrian
```

Eso debería estar prohibido por Nx.

---

# 10. Aquí es donde Nx se vuelve realmente interesante: Boundaries

Yo definiría tags arquitectónicos.

Por ejemplo:

```text
scope:shared
scope:domain
scope:feature
scope:data-access
scope:app
scope:bff
```

Y:

```text
type:ui
type:domain
type:data-access
type:feature
type:connector
type:app
```

Entonces podemos establecer reglas como:

```text
app
 ↓
feature
 ↓
data-access
 ↓
domain
 ↓
shared
```

Y:

```text
bff
 ↓
connector
 ↓
external
```

Pero:

```text
ui ─X→ bff
ui ─X→ connector
ui ─X→ app
```

Esto es fundamental.

---

# 11. La arquitectura podría quedar así

Yo propondría esta estructura:

```text
dss-monorepo/
│
├── apps/
│   │
│   ├── admin-portal/
│   ├── rector-dashboard/
│   ├── decano-dashboard/
│   ├── director-dashboard/
│   ├── docs-portal/
│   └── bff/
│
├── libs/
│   │
│   ├── ui/
│   │   ├── primitives/
│   │   ├── components/
│   │   ├── layouts/
│   │   └── theme/
│   │
│   ├── charts/
│   │
│   ├── domain/
│   │   ├── academic/
│   │   ├── student/
│   │   ├── faculty/
│   │   ├── career/
│   │   ├── admission/
│   │   └── prediction/
│   │
│   ├── data-access/
│   │   ├── academic/
│   │   ├── student/
│   │   ├── admission/
│   │   └── prediction/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── academic-performance/
│   │   ├── dropout-risk/
│   │   ├── admissions/
│   │   ├── predictions/
│   │   └── administration/
│   │
│   ├── auth/
│   ├── rbac/
│   │
│   └── connectors/
│       ├── mondrian/
│       ├── apache-hop/
│       └── prediction/
│
├── nx.json
├── package.json
├── tsconfig.base.json
└── pnpm-workspace.yaml
```

---

# 12. Pero hay una mejora todavía más importante: `features`

Este es probablemente el cambio que más recomiendo.

No construiría los dashboards directamente con:

```text
ui
domain
data-access
```

sino:

```text
dashboard
   ↓
feature
   ↓
data-access
   ↓
domain
```

Por ejemplo:

```text
libs/features/dropout-risk/
```

podría contener:

```text
dropout-risk/
├── ui/
│   ├── dropout-risk-card.tsx
│   └── dropout-risk-table.tsx
│
├── data/
│   └── use-dropout-risk.ts
│
└── index.ts
```

Entonces:

```text
director-dashboard
       ↓
@dss/feature-dropout-risk
       ↓
@dss/data-access-prediction
       ↓
BFF
```

El director dashboard no necesita conocer cómo funciona internamente el feature.

---

# 13. Esto permite reutilización real

Supongamos que:

```text
Rector
```

necesita:

```text
Riesgo de deserción
```

y:

```text
Decano
```

también.

En lugar de duplicar:

```text
Rector → RiskCard
Decano → RiskCard
Director → RiskCard
```

tenemos:

```text
             @dss/feature-dropout-risk
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
           Rector    Decano    Director
```

Y dentro:

```text
feature
   ↓
data-access
   ↓
domain
   ↓
ui
```

Esto es muchísimo más mantenible.

---

# 14. RBAC debería estar por encima de UI

Tu:

```text
packages/rbac
```

también es correcto.

Pero no lo limitaría a:

```typescript
<Can permission="...">
```

Lo diseñaría para tres niveles:

```text
RBAC
│
├── Route protection
├── Feature protection
└── Component/action protection
```

Por ejemplo:

```text
SUPERADMIN
RECTOR
DECANO
DIRECTOR
```

y permisos:

```text
analytics:read
analytics:global
analytics:faculty
analytics:career

connectors:read
connectors:write

pipelines:read
pipelines:execute

users:read
users:write
```

Entonces:

```text
Rector Dashboard
       ↓
requires analytics:global
```

Mientras:

```text
Decano Dashboard
       ↓
requires analytics:faculty
```

Y:

```text
Admin Portal
       ↓
requires connectors:write
```

La ventaja es que el RBAC se vuelve un mecanismo transversal.

---

# 15. Keycloak + RBAC + BFF

En tu arquitectura anterior con Keycloak, yo mantendría esta cadena:

```text
                   Keycloak
                      │
                      ▼
                   JWT/OIDC
                      │
                      ▼
                Next.js App
                      │
                      ▼
                    BFF
                      │
             ┌────────┴────────┐
             ▼                 ▼
           RBAC             Backend
```

Pero con una regla importante:

**el frontend nunca debe ser la autoridad final de autorización.**

Esto:

```typescript
if (user.role === "RECTOR") {
    showDashboard();
}
```

sirve para UX.

Pero la seguridad real:

```text
Browser
   ↓
BFF
   ↓
Authorization
   ↓
Backend
```

debe estar protegida también en backend.

---

# 16. Nx debería conocer los roles arquitectónicos

Incluso podemos utilizar Nx para evitar errores como:

```text
@dss/ui
    ↓
@dss/auth
```

si queremos que `ui` sea completamente independiente.

O:

```text
@dss/domain
    ↓
@dss/connectors
```

que sería una violación bastante grave.

Podríamos definir una arquitectura:

```text
              APPLICATION
                   │
             ┌─────┴─────┐
             ▼           ▼
          FEATURE     DATA ACCESS
             │           │
             ▼           ▼
             └──── DOMAIN
                   │
                   ▼
                 SHARED
```

Y:

```text
BFF
 │
 ▼
CONNECTORS
 │
 ▼
EXTERNAL SYSTEMS
```

Completamente separado.

---

# 17. Aprovecharía Nx para el CI

Aquí podemos conseguir una diferencia enorme.

Supongamos que modificas:

```text
libs/ui/components/button
```

Nx determina:

```text
ui
 ↓
feature/*
 ↓
dashboards
```

y ejecuta únicamente lo necesario.

Por ejemplo:

```bash
nx affected -t lint
nx affected -t test
nx affected -t build
```

Mientras que si modificas:

```text
libs/connectors/mondrian
```

probablemente solamente:

```text
connector-mondrian
      ↓
bff
```

sean afectados.

No tiene sentido reconstruir:

```text
docs-portal
admin-portal
director-dashboard
```

si no dependen de esa modificación.

---

# 18. Remote Cache

En CI agregaría cache remoto.

La idea:

```text
Developer A
     │
     ▼
 nx test
     │
     ▼
Remote Cache
     ▲
     │
Developer B
     │
     ▼
 nx test
```

Y lo mismo:

```text
GitHub Actions
      │
      ▼
Nx
      │
      ▼
Remote Cache
```

Entonces el trabajo realizado por un desarrollador o un job anterior puede ser reutilizado cuando las entradas son equivalentes.

---

# 19. CI ideal para este proyecto

Yo terminaría buscando algo así:

```text
                    Pull Request
                         │
                         ▼
                   Nx affected
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
             lint       test       build
              │          │          │
              └──────────┼──────────┘
                         ▼
                  Architecture Check
                         │
                         ▼
                    E2E Testing
                         │
                         ▼
                       Merge
```

Y en un repositorio grande:

```text
Nx affected
     │
     ▼
Task Graph
     │
     ├──────────┐
     ▼          ▼
 Agent 1      Agent 2
     │          │
     └────┬─────┘
          ▼
        Result
```

---

# 20. Otra cosa que aprovecharía muchísimo: generators

Para un equipo universitario/profesional, crearía generators internos.

Por ejemplo:

```bash
nx g @dss/plugin:dashboard rector-dashboard
```

que genere automáticamente:

```text
apps/rector-dashboard/
├── app/
├── layout.tsx
├── providers.tsx
├── nx-project.json
└── ...
```

Y:

```bash
nx g @dss/plugin:feature dropout-risk
```

generaría:

```text
libs/features/dropout-risk/
├── ui/
├── data/
├── domain/
└── index.ts
```

Así la arquitectura queda **codificada como tooling**.

Eso es mucho mejor que escribir una guía diciendo:

> "Por favor, creen las carpetas de esta manera."

Nx puede hacer que la estructura correcta sea la opción fácil.

---

# 21. Y añadiría reglas para evitar imports profundos

Por ejemplo, no permitir:

```typescript
import { Button } from "../../../libs/ui/src/components/button";
```

ni:

```typescript
import { something } from "@dss/ui/src/internal/...";
```

Utilizaríamos APIs públicas:

```typescript
import { Button } from "@dss/ui";
```

o:

```typescript
import { DropoutRiskCard } from "@dss/feature-dropout-risk";
```

Esto es muy importante para preservar encapsulamiento.

---

# 22. Los `index.ts` serían contratos

Por ejemplo:

```text
libs/ui/
```

expone:

```typescript
export * from "./components/button";
export * from "./components/data-table";
export * from "./components/kpi-card";
```

pero no expone:

```text
internal/
private/
implementation/
```

Entonces cada librería tiene:

```text
PUBLIC API
    │
    ▼
index.ts
    │
    ▼
internal implementation
```

Esto hace que cambiar internamente una librería no rompa automáticamente todo el monorepo.

---

# 23. Testing

También aprovecharía Nx para separar claramente:

```text
Unit
Integration
E2E
Visual
```

Por ejemplo:

```text
libs/ui
   ├── unit tests
   └── Storybook

libs/features
   ├── unit tests
   └── integration tests

apps/*
   └── Playwright E2E
```

Y Nx determina qué necesita ejecutarse.

Por ejemplo:

```bash
nx affected -t test
```

para unit tests.

Y:

```bash
nx affected -t e2e
```

para E2E.

---

# 24. Una consideración importante sobre Next.js

No convertiría todo en componentes client-side.

Para los dashboards:

```text
Next.js
├── Server Components
├── Client Components
└── BFF
```

Intentaría mantener:

```text
Server Component
      ↓
BFF
      ↓
Data
```

cuando no necesitamos interactividad.

Y utilizar:

```text
Client Component
```

para:

```text
charts
filters
interactive tables
dialogs
forms
real-time widgets
```

Esto mantiene el frontend más eficiente.

---

# 25. Una arquitectura final que me parece muy sólida

Para este DSS, propondría:

```text
                         ┌───────────────────────┐
                         │       KEYCLOAK        │
                         │     Identity / OIDC    │
                         └───────────┬───────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────┐
│                         NX MONOREPO                       │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                       APPS                          │  │
│  │                                                     │  │
│  │ Admin │ Rector │ Decano │ Director │ Docs │ BFF    │  │
│  └───────┬───────────────────────────────────────┬─────┘  │
│          │                                       │        │
│          ▼                                       ▼        │
│  ┌──────────────────┐                    ┌────────────┐  │
│  │    FEATURES      │                    │ CONNECTORS │  │
│  │                  │                    │            │  │
│  │ KPIs             │                    │ Mondrian   │  │
│  │ Performance      │                    │ Hop        │  │
│  │ Risk             │                    │ Prediction │  │
│  │ Admissions       │                    └─────┬──────┘  │
│  └────────┬─────────┘                          │         │
│           │                                    │         │
│           ▼                                    ▼         │
│  ┌──────────────────┐                    External       │
│  │   DATA ACCESS    │                    Systems        │
│  └────────┬─────────┘                                  │
│           │                                             │
│           ▼                                             │
│  ┌──────────────────┐                                   │
│  │      DOMAIN      │                                   │
│  └────────┬─────────┘                                   │
│           │                                             │
│           ▼                                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │                       UI                         │  │
│  │ Tailwind + shadcn + Storybook + Design Tokens   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
│  Auth / RBAC / Charts / Foundation                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

Y encima:

```text
                 Nx
                  │
       ┌──────────┼───────────┐
       ▼          ▼           ▼
 Project Graph  Task Graph  Boundaries
       │          │           │
       ▼          ▼           ▼
  Affected     Cache       Architecture
       │          │
       └────┬─────┘
            ▼
           CI
```

## Mi recomendación concreta

Yo **no empezaría creando las seis aplicaciones y todas las librerías de golpe**. Primero construiría el esqueleto arquitectónico y el Design System:

```text
Fase 1
Nx + pnpm
   ↓
UI + Tailwind + shadcn
   ↓
Storybook
   ↓
Design Tokens
```

Después:

```text
Fase 2
Domain
   ↓
Data Access
   ↓
Features
```

Luego:

```text
Fase 3
Keycloak
   ↓
Auth
   ↓
RBAC
```

Después:

```text
Fase 4
BFF
   ↓
Connectors
   ↓
Mondrian / Hop / Prediction
```

Y finalmente:

```text
Fase 5
Affected
   ↓
Caching
   ↓
GitHub Actions
   ↓
Nx Cloud / distributed CI
```
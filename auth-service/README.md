# UATF DSS - Auth Service (IAM)

Microservicio de Gestión de Identidad y Accesos (IAM) para el Sistema de Soporte a Decisiones (DSS) de la Universidad Autónoma Tomás Frías (UATF).

Este servicio actúa como un **Resource Server** y coordinador de lógica de negocio, validando los tokens JWT emitidos por nuestro proveedor de identidad centralizado (**Keycloak**) y enriqueciendo el perfil del usuario con su **Contexto Académico** interno (Ej. Facultad, Carrera) aplicando permisos granulares de Row-Level Security.

## 🛠️ Stack Tecnológico

- **Lenguaje:** Java 21
- **Framework:** Spring Boot 3.x
- **Arquitectura:** Hexagonal Architecture (Ports and Adapters)
- **Seguridad:** Spring Security (OAuth2 Resource Server + JWT)
- **Base de Datos:** PostgreSQL
- **Migraciones:** Flyway / Liquibase
- **Testing:** JUnit 5, Mockito, Testcontainers (TDD)
- **Identity Provider (IdP):** Keycloak

## 📂 Arquitectura (Ports and Adapters / Hexagonal)

El proyecto promueve un alto desacoplamiento y testeabilidad organizando sus paquetes bajo el patrón estricto de **Arquitectura Hexagonal (Ports and Adapters)**:

```text
uatf.dss.authservice
 ├── domain          # Capa 100% pura: Entidades de negocio y reglas. Sin dependencias externas.
 │
 ├── application     # Casos de Uso y orquestación.
 │    ├── port       # Interfaces: 'in' (Driving Ports) y 'out' (Driven Ports).
 │    └── service    # Implementación de los puertos 'in' (Casos de uso).
 │
 ├── adapter         # El mundo exterior (Implementaciones tecnológicas).
 │    ├── in         # Driving Adapters: Quien llama a la aplicación (Ej: web/REST).
 │    └── out        # Driven Adapters: A quien llama la aplicación (Ej: persistence/JPA).
 │
 └── configuration   # Ensamblaje de la aplicación (Inyección manual de dependencias).
```
*Regla de Oro: Las capas de `domain` y `application` no pueden tener importaciones de librerías de infraestructura como Spring Framework, Hibernate o librerías web (Dependency Inversion).*

### 📐 Convenciones de Diseño de los Adaptadores

Para mantener la Arquitectura Hexagonal escalable y proteger el encapsulamiento, este proyecto sigue reglas estrictas en el interior de la capa `adapter`:

1. **Aislamiento por Tecnología de Entrada (`adapter/in`)**: 
   Cada tecnología de entrega (REST, gRPC, Eventos) tiene su propio paquete dedicado (ej. `in/web`, `in/grpc`). Comparten los mismos Casos de Uso (Driving Ports) pero su implementación tecnológica es completamente independiente.
   
2. **Agrupación por Concepto de Negocio (`adapter/out/persistence`)**:
   Dentro del adaptador de persistencia, las clases **NO** se dividen por tipos técnicos (`entity`, `repository`). En su lugar, se agrupan por *Feature* o Agregado (ej. `persistence/user`, `persistence/role`).
   * **Beneficio de Encapsulamiento:** Esto permite que las entidades JPA (`UserEntity`) y los repositorios de Spring Data usen visibilidad `package-private` (ausencia de `public`). 
   * **Protección Arquitectónica:** Al no ser públicos, el compilador de Java garantiza que las capas centrales (`domain`, `application`) jamás puedan importar detalles de base de datos por accidente. Únicamente el adaptador implementador (ej. `UserRepositoryAdapter`) es público.
## 📋 Requisitos Previos

- Java 21 (JDK)
- Gradle o Maven (según el wrapper del proyecto)
- Docker y Docker Compose (Para Testcontainers, PostgreSQL y Keycloak locales)

## 🚀 Inicio Rápido (Desarrollo)

### 1. Levantar Infraestructura Local (Keycloak + Base de Datos)
Para ejecutar el entorno local, asegúrate de iniciar los contenedores de infraestructura. (Se requiere un archivo `docker-compose.yml` en la raíz).
```bash
docker-compose up -d
```

### 2. Compilación y Ejecución
Compila el proyecto y ejecútalo utilizando el wrapper correspondiente.
```bash
# Con Gradle
./gradlew bootRun

# Con Maven
./mvnw spring-boot:run
```

### 3. Pruebas (TDD)
El proyecto está construido bajo una estricta filosofía de **Test-Driven Development (TDD)**. Las pruebas de integración levantarán automáticamente su propia instancia de PostgreSQL utilizando **Testcontainers**.
```bash
# Ejecutar todas las pruebas (Unitarias e Integración)
./gradlew test
```

## 🗺️ Roadmap y Tareas de Desarrollo

El desarrollo de este servicio ha sido granularizado en Épicas e Issues detallados en la carpeta `planning/auth-service/IssueDetails/`. 

- **Épica 1:** Configuración Base e Infraestructura (Proyecto, DB, Keycloak).
- **Épica 2:** Dominio y Persistencia (Reglas de negocio puras y adaptadores JPA).
- **Épica 3:** Seguridad y Casos de Uso (Resource Server y lógica de aplicación).
- **Épica 4:** Presentación y API REST (Endpoints para la SPA y sincronización).
- **Épica 5:** Despliegue (Dockerización multi-stage).

## 🔐 Seguridad y Privacidad (RNF4.1)

Este servicio implementa las reglas de negocio de la UATF para garantizar la privacidad de los datos académicos. Un Decano solo tendrá contexto para ver la información de su respectiva Facultad, y un Director de Carrera, la de su Carrera. Este contexto es gestionado localmente por este microservicio tras verificar la identidad global autenticada en Keycloak.

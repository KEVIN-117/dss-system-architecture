# UATF DSS - Auth Service (IAM)

Microservicio de Gestión de Identidad y Accesos (IAM) para el Sistema de Soporte a Decisiones (DSS) de la Universidad Autónoma Tomás Frías (UATF).

Este servicio actúa como un **Resource Server** y coordinador de lógica de negocio, validando los tokens JWT emitidos por nuestro proveedor de identidad centralizado (**Keycloak**) y enriqueciendo el perfil del usuario con su **Contexto Académico** interno (Ej. Facultad, Carrera) aplicando permisos granulares de Row-Level Security.

## 🛠️ Stack Tecnológico

- **Lenguaje:** Java 21
- **Framework:** Spring Boot 3.x
- **Arquitectura:** Onion Architecture / Clean Architecture
- **Seguridad:** Spring Security (OAuth2 Resource Server + JWT)
- **Base de Datos:** PostgreSQL
- **Migraciones:** Flyway / Liquibase
- **Testing:** JUnit 5, Mockito, Testcontainers (TDD)
- **Identity Provider (IdP):** Keycloak

## 📂 Arquitectura (Onion Architecture)

El proyecto promueve un alto desacoplamiento y testeabilidad organizando sus paquetes bajo el patrón de Onion Architecture:

```text
uatf.dss.auth
 ├── domain          # Capa interna: Entidades puras y reglas de negocio. Sin dependencias externas.
 │    ├── model      # (Ej: User, Role, UserAcademicContext)
 │    └── ports      # Interfaces de salida (Ej: UserRepository)
 │
 ├── application     # Casos de Uso (Ej: GetAuthUserProfileUseCase)
 │
 ├── infrastructure  # Adaptadores de salida: Persistencia, JPA, y Clientes externos
 │
 └── presentation    # Adaptadores de entrada: Controladores REST, Endpoints y Webhooks
```
*Regla de Oro: La capa de `domain` y `application` no pueden tener importaciones de librerías de infraestructura como Spring Framework, Hibernate o librerías web.*

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

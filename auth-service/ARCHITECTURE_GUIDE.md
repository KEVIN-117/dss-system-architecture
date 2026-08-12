# Guía de Arquitectura del Servicio de Autenticación (Hexagonal / Ports & Adapters)

Este documento detalla los principios, límites, convenciones de nomenclatura, organización de archivos y mecanismos de validación automatizada que rigen la arquitectura del microservicio de autenticación (`auth-service`). Es de lectura obligatoria para todos los desarrolladores del equipo.

---

## 1. Modelo Mental: Ports and Adapters

La arquitectura del servicio se basa en el patrón **Ports and Adapters** (Arquitectura Hexagonal). El objetivo principal es aislar las reglas de negocio (Dominio) y la lógica de flujo (Aplicación) de los detalles tecnológicos e infraestructura (Bases de datos, frameworks, protocolos de red, colas de mensajería).

```text
               +---------------------------------------------------+
               |                    ADAPTADORES                    |
               |                                                   |
               |   +-------------------------------------------+   |
               |   |                APLICACIÓN                 |   |
               |   |                                           |   |
               |   |   +-----------------------------------+   |   |
               |   |   |              DOMINIO              |   |   |
               |   |   |                                   |   |   |
   WEB/REST    |   |   |   * Entidades de Dominio          |   |   |  Base de Datos
 (Driving Ad.) |-->|-->|   * Excepciones de Negocio        |   |<--|<-- (Driven Ad.)
   [adapter/in]|   |   |                                   |   |   | [adapter/out]
               |   |   +-----------------------------------+   |   |
               |   |                                           |   |
               |   |   * Casos de Uso (Driving Ports: in)      |   |
               |   |   * Contratos Repos (Driven Ports: out)   |   |
               |   |   * Servicios de Aplicación               |   |
               |   +-------------------------------------------+   |
               |                                                   |
               +---------------------------------------------------+
```

### Regla Fundamental de Dependencia (Dependency Inversion)
Las dependencias de código siempre deben apuntar **hacia adentro**. Las capas internas nunca deben conocer la existencia de las capas externas.
- El **Dominio** no conoce la **Aplicación**, los **Adaptadores** ni el Framework (**Spring**).
- La **Aplicación** solo conoce el **Dominio**. No conoce los **Adaptadores** (ej. no sabe si el cliente es una API REST, gRPC o una base de datos PostgreSQL).
- Los **Adaptadores** conocen la **Aplicación** y el **Dominio**.

---

## 2. Estructura de Paquetes con Micro-Precisión

La raíz del microservicio es `uatf.dss.authservice`. El árbol de directorios y la visibilidad de los componentes se define así:

```text
uatf.dss.authservice
 ├── domain
 │    ├── model             # Entidades puras y objetos de valor (ej: ExampleUser.java)
 │    └── exception         # Excepciones de negocio (ej: ExampleUserAlreadyExistsException.java)
 │
 ├── application
 │    ├── port
 │    │    ├── in           # Driving Ports: Interfaces de casos de uso (ej: RegisterExampleUserUseCase.java)
 │    │    │                # y comandos/DTOs de entrada (ej: RegisterExampleUserCommand.java)
 │    │    └── out          # Driven Ports: Interfaces de infraestructura externa (ej: ExampleUserRepository.java)
 │    └── service           # Implementación de los casos de uso (ej: RegisterExampleUserService.java)
 │
 ├── adapter
 │    ├── in
 │    │    └── web          # Driving Adapter: Controladores REST (ej: ExampleUserController.java) y DTOs web
 │    └── out
 │         └── persistence  # Driven Adapter: Persistencia JPA agrupado por concepto de negocio (Feature)
 │              └── exampleuser
 │                   ├── ExampleUserEntity.java              (Package-Private)
 │                   ├── SpringDataExampleUserRepository.java (Package-Private)
 │                   ├── ExampleUserPersistenceMapper.java    (Package-Private)
 │                   └── ExampleUserRepositoryAdapter.java    (Public)
 │
 ├── configuration          # Wire y configuración del contexto de Spring (ej: ApplicationConfig.java)
 └── AuthServiceApplication.java (Bootstrap de Spring Boot)
```

---

## 3. Guía de Responsabilidad por Capa

### A. Capa de Dominio (`domain`)
- **Responsabilidad:** Contener las entidades y reglas de negocio más puras e invariantes.
- **Regla Estricta:** No debe contener ninguna importación de Spring Framework, Jakarta Persistence (JPA/Hibernate), o librerías de serialización (Jackson).
- **Inyección de dependencias:** Prohibida. Es lógica puramente procedural u orientada a objetos.

### B. Capa de Aplicación (`application`)
- **Responsabilidad:** Orquestar los casos de uso del negocio.
- **Casos de Uso (`application.port.in`):** Interfaces que exponen las operaciones que el sistema puede realizar. Vienen acompañadas de un *Command* (un Record inmutable) que valida los datos básicos de entrada antes de procesar el flujo.
- **Puertos de Salida (`application.port.out`):** Interfaces que definen las necesidades de infraestructura de la aplicación (ej: `ExampleUserRepository`).
- **Servicios (`application.service`):** Implementan los casos de uso. Coordinan entidades y llaman a los puertos de salida.
- **Regla Estricta:** No se usan anotaciones de Spring (`@Service`, `@Autowired`, `@Component`). Los servicios se declaran como clases Java puras para mantenerlos testeables y desacoplados del Framework. Se inyectan manualmente en la capa `configuration`.

### C. Capa de Adaptadores (`adapter`)
- **Responsabilidad:** Traducir las peticiones externas al lenguaje de la aplicación, y las peticiones de la aplicación a tecnologías específicas.
- **Adaptadores de Entrada (`adapter/in`):** Reciben peticiones (HTTP, eventos de colas, gRPC). Traducen DTOs de entrada a `Command` de aplicación y ejecutan el caso de uso (`UseCase`).
- **Adaptadores de Salida (`adapter/out`):** Implementan los puertos de salida (`port/out`). Se comunican con base de datos, APIs de terceros, discos locales, etc.

---

## 4. Estrategia de Encapsulamiento y Mapeo (MapStruct)

Para evitar que los detalles de la base de datos o de red se filtren a las capas lógicas, cada adaptador es responsable de realizar la traducción mediante un **Mapper**.

### Encapsulamiento con Visibilidad `package-private`
Dentro del paquete de persistencia de una Feature (ej: `persistence.exampleuser`), protegemos el acoplamiento no deseado usando el modificador de acceso por defecto de Java (eliminando la palabra `public` de la clase):

1. **`ExampleUserEntity`** (La entidad JPA) debe ser `package-private`. Nadie fuera de este paquete puede instanciarla.
2. **`SpringDataExampleUserRepository`** (El repositorio de Spring Data JPA) debe ser `package-private`. Nadie puede inyectarlo directamente fuera de su paquete.
3. **`ExampleUserPersistenceMapper`** (La interfaz de MapStruct) debe ser `package-private`.
4. **`ExampleUserRepositoryAdapter`** debe ser el único `public` de la carpeta, ya que implementa la interfaz pública de la aplicación (`ExampleUserRepository`).

### Integración de MapStruct + Lombok
El proyecto está configurado en el `pom.xml` para integrar MapStruct 1.6+ y Lombok en armonía. 

La interfaz del mapper se declara simplemente de esta manera:
```java
package uatf.dss.authservice.adapter.out.persistence.exampleuser;

import org.mapstruct.Mapper;
import uatf.dss.authservice.domain.model.ExampleUser;

@Mapper // MapStruct inyectará este componente como un Bean de Spring gracias a la configuración global del compilador.
interface ExampleUserPersistenceMapper {
    ExampleUserEntity toEntity(ExampleUser domain);
    ExampleUser toDomain(ExampleUserEntity entity);
}
```

El adaptador inyecta y utiliza el mapper limpiamente:
```java
@Repository
class ExampleUserRepositoryAdapter implements ExampleUserRepository {
    private final SpringDataExampleUserRepository springDataRepository;
    private final ExampleUserPersistenceMapper mapper;

    public ExampleUserRepositoryAdapter(SpringDataExampleUserRepository springDataRepository, ExampleUserPersistenceMapper mapper) {
        this.springDataRepository = springDataRepository;
        this.mapper = mapper;
    }

    @Override
    public ExampleUser save(ExampleUser user) {
        ExampleUserEntity entity = mapper.toEntity(user);
        ExampleUserEntity savedEntity = springDataRepository.save(entity);
        return mapper.toDomain(savedEntity);
    }
}
```

---

## 5. Validación Automatizada de la Arquitectura (ArchUnit)

La arquitectura no es solo una sugerencia escrita; **está protegida mediante código**. En el archivo [ArchitectureTest.java](file:///C:/Users/krodr/profile/private/dss-system-architecture/auth-service/src/test/java/uatf/dss/authservice/ArchitectureTest.java), se ejecutan tests automatizados con **ArchUnit** que verifican el cumplimiento de las siguientes reglas en cada compilación:

1. **Aislamiento Total del Dominio:**
   El paquete `domain` no puede importar nada que resida en `application`, `adapter` o `configuration`.
2. **Independencia de la Aplicación:**
   El paquete `application` no puede importar nada que resida en `adapter` o `configuration`.
3. **Prohibición de Spring en las Capas de Negocio:**
   Ninguna clase dentro de `domain` ni `application` puede importar clases pertenecientes a `org.springframework..`.
4. **Protección Contra Dependencia de Configuración:**
   Los adaptadores (`adapter`) no pueden importar clases de `configuration`.
5. **Independencia entre Adaptadores (Slice Test):**
   Los adaptadores de tecnologías diferentes no pueden acoplarse entre sí (ej. `adapter.in.web` no puede importar clases de `adapter.out.persistence`).
6. **Límites de Controladores (In Ports):**
   Los controladores REST deben depender únicamente de los puertos de entrada (`port.in`), nunca saltarse la capa de aplicación inyectando puertos de salida o servicios directamente.
7. **Límites de Controladores (No Out Ports):**
   Los controladores REST tienen prohibido depender de interfaces de salida (`port.out`).

Si algún desarrollador rompe una de estas reglas (por ejemplo, importando una entidad JPA en un servicio de aplicación, o agregando una anotación `@Service` de Spring), **el comando `./mvnw test` fallará inmediatamente**, impidiendo que el código sea integrado a la rama `main`.

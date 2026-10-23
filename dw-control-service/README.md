# DW Control Service

API administrativa para consultar cierres académicos y, en los alcances previstos, supervisar ejecuciones ETL. La API valida tokens JWT y autoriza cada operación mediante permisos del cliente `dw-control-service`.

## Requisitos

- Java 21. El proyecto incluye Gradle Wrapper; no necesitas instalar Gradle por separado.
- Acceso a Maven Central la primera vez que el wrapper descarga Gradle y las dependencias.

Las pruebas automatizadas usan H2 y una configuración de test. Para ejecutar lint, tests y build no necesitas iniciar PostgreSQL, Keycloak ni Docker.

## Validar en Windows

Abre PowerShell en la raíz del repositorio y entra al proyecto:

```powershell
Set-Location .\dw-control-service
```

Ejecuta las tareas por separado cuando quieras revisar una etapa:

```powershell
# Comprueba formato y limpieza de imports con Spotless.
.\gradlew.bat lint

# Ejecuta la suite de pruebas.
.\gradlew.bat test

# Ejecuta todas las verificaciones (tests y lint), compila y genera el JAR.
.\gradlew.bat build
```

Para una validación limpia completa antes de integrar cambios:

```powershell
.\gradlew.bat clean build
```

`build` incluye `check`, y `check` ejecuta `test` y `lint`. Si solo necesitas confirmar todas las verificaciones sin empaquetar el JAR, usa:

```powershell
.\gradlew.bat check
```

El JAR ejecutable se genera en `build\libs\dw-control-service.jar`.

### Corregir formato

Si `lint` indica violaciones de formato, aplica el formato y vuelve a validar:

```powershell
.\gradlew.bat spotlessApply
.\gradlew.bat lint
```

## Validar en Linux o macOS

Desde la raíz del repositorio:

```bash
cd dw-control-service
./gradlew lint
./gradlew test
./gradlew clean build
```

## Configuración y ejecución local

Consulta las variables y valores por ambiente en [`docs/envs/dw-control-service.md`](../docs/envs/dw-control-service.md). Para levantar el servicio conectado a PostgreSQL y Keycloak, configura el ambiente local según esa guía y ejecuta:

```powershell
.\gradlew.bat bootRun
```

La documentación de arquitectura y permisos está en [`docs/dw/dw-control-service-architecture.md`](../docs/dw/dw-control-service-architecture.md), y el contrato OpenAPI en [`docs/dw/contracts/dw-control-service-v1.yaml`](../docs/dw/contracts/dw-control-service-v1.yaml).

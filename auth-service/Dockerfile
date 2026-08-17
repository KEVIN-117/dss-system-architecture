# ==========================================
# Etapa 1: Build (Construcción)
# ==========================================
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

# 1. Copiar el wrapper y el descriptor de dependencias
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# 2. Dar permisos de ejecución al wrapper
RUN chmod +x ./mvnw

# 3. Descargar dependencias offline.
# Esta capa se cacheará a menos que pom.xml cambie, ahorrando minutos de red.
RUN ./mvnw dependency:go-offline -B

# 4. Copiar el código fuente y compilar
COPY src ./src
RUN ./mvnw clean package -DskipTests

# ==========================================
# Etapa 2: Runtime (Ejecución Segura y Ligera)
# ==========================================
FROM eclipse-temurin:21-jre-alpine AS runtime

WORKDIR /app

# 1. Crear un usuario y grupo no-root para mejorar la seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 2. Copiar el artefacto desde la fase de build y cambiar propietario
COPY --from=build --chown=appuser:appgroup /app/target/*.jar app.jar

# 3. Cambiar al usuario con menos privilegios
USER appuser

# Documentar puerto estándar
EXPOSE 8080

# 4. Entrypoint seguro y limpio (permitiendo graceful shutdown)
ENTRYPOINT ["java", "-jar", "app.jar"]
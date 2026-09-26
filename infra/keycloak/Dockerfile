# === Stage 1: Build optimizado ===
FROM quay.io/keycloak/keycloak:26.7.4 AS builder

# Build-time options (locked at build)
ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true
# Si se usa Traefik como proxy:
# ENV KC_HTTP_RELATIVE_PATH=/auth

# Copiar el provider SPI del webhook
COPY providers/ /opt/keycloak/providers/
COPY themes/ /opt/keycloak/themes/

# Ejecutar build de Quarkus (pre-compila, reduce startup de ~15s a ~2s)S

RUN /opt/keycloak/bin/kc.sh build

# === Stage 2: Instalar dependencias extra (curl, ping) en ubi-micro ===
FROM registry.access.redhat.com/ubi9/ubi:latest AS ubi-micro-build
RUN mkdir -p /mnt/rootfs && \
    dnf install --installroot /mnt/rootfs --releasever 9 --setopt install_weak_deps=False --nodocs -y curl iputils coreutils-single && \
    dnf --installroot /mnt/rootfs clean all && \
    rm -rf /mnt/rootfs/etc /mnt/rootfs/var /mnt/rootfs/run /mnt/rootfs/tmp

# === Stage 3: Runtime optimizado ===
FROM quay.io/keycloak/keycloak:26.7.4

COPY --from=builder /opt/keycloak/ /opt/keycloak/

# Runtime-only config vía env vars (KC_*)
# No hardcodear secretos aquí

# Copiamos curl e iputils desde el stage ubi-micro-build
USER root
COPY --from=ubi-micro-build /mnt/rootfs /
USER keycloak

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]

# Default: producción. Override en docker-compose para dev.
CMD ["start", "--optimized"]

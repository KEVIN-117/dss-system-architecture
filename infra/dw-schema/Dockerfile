FROM postgres:15-alpine

ARG MIGRATIONS_VERSION=dev

LABEL org.opencontainers.image.title="chronos-dw-migrator" \
    org.opencontainers.image.description="One-shot runner de migraciones del DW de CHRONOS" \
    org.opencontainers.image.version="${MIGRATIONS_VERSION}"

COPY scripts/*.sh /usr/local/bin/
COPY migrations/*.sql /migrations/

RUN sed -i 's/\r$//' /usr/local/bin/apply-migrations.sh \
    && chmod 0555 /usr/local/bin/apply-migrations.sh \
    && chmod -R a+rX /migrations

USER postgres

ENTRYPOINT ["/usr/local/bin/apply-migrations.sh"]
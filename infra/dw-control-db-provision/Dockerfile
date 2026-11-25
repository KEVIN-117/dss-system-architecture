FROM postgres:15-alpine

ARG PROVISION_VERSION=dev

LABEL org.opencontainers.image.title="chronos-dw-control-db-provision" \
    org.opencontainers.image.description="One-shot runner de provisionamiento del rol runtime de dw-control en CHRONOS DW" \
    org.opencontainers.image.version="${PROVISION_VERSION}"

COPY scripts/*.sh /usr/local/bin/
COPY scripts/*.sql /scripts/

RUN sed -i 's/\r$//' /usr/local/bin/provision-runtime.sh \
    && chmod 0555 /usr/local/bin/provision-runtime.sh \
    && chmod -R a+rX /scripts

USER postgres

ENTRYPOINT ["/usr/local/bin/provision-runtime.sh"]

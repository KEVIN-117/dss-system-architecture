FROM alpine:3.20

ARG CATALOG_VERSION=dev

LABEL org.opencontainers.image.title="chronos-olap-home-init" \
    org.opencontainers.image.description="One-shot initializer for persistent Saiku OLAP catalog and datasources" \
    org.opencontainers.image.version="${CATALOG_VERSION}"

COPY scripts/initialize-academic-olap.sh /usr/local/bin/initialize-academic-olap.sh
COPY datasources/uatf-dw.sds /source/uatf-dw.sds
COPY schemas/uatf-rendimiento-academico.xml /source/uatf-rendimiento-academico.xml

RUN sed -i 's/\r$//' /usr/local/bin/initialize-academic-olap.sh \
    && chmod 0555 /usr/local/bin/initialize-academic-olap.sh \
    && chmod -R a+rX /source

ENTRYPOINT ["/usr/local/bin/initialize-academic-olap.sh"]

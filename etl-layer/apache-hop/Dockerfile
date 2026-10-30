# syntax=docker/dockerfile:1.7
ARG HOP_WEB_VERSION=2.19.0
FROM apache/hop-web:${HOP_WEB_VERSION}

LABEL org.opencontainers.image.title="DSS Apache Hop Web" \
      org.opencontainers.image.description="DSS UATF ETL project bundled with Apache Hop Web"

# Hop Web runs as the `hop` user; keep its project files writable so the
# configuration manager can create and update environment configuration.
COPY --chown=hop:hop projects/dss-uatf-etl/ /files/project/
COPY scripts/start-hop-web.sh /files/scripts/start-hop-web.sh
COPY jdbc/postgresql-42.7.11.jar /usr/local/tomcat/jdbc-drivers/postgresql-42.7.11.jar

ENV HOP_PROJECT_NAME=dss-uatf-etl \
    HOP_PROJECT_FOLDER=/files/project \
    HOP_PROJECT_CONFIG_FILE_NAME=project-config.json \
    HOP_SHARED_JDBC_FOLDERS=/usr/local/tomcat/jdbc-drivers

ENTRYPOINT ["/bin/bash", "/files/scripts/start-hop-web.sh"]

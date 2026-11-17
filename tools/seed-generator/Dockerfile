# syntax=docker/dockerfile:1.7
# Imagen del pipeline de seed OLTP (genera → carga → valida → exporta → sella).
# Contexto: tools/seed-generator. Los catálogos llegan por el contexto
# adicional `catalogs` (docs/seed-data/catalogs), declarado en docker-compose.yml.

FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile
COPY src ./src
RUN bunx tsc -p .

FROM oven/bun:1.3.14-alpine AS runtime
RUN apk add --no-cache postgresql15-client coreutils
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY --from=catalogs . ./catalogs
COPY docker/ ./docker/
# Normaliza finales de línea por si el checkout de Windows usa CRLF.
RUN sed -i 's/\r$//' docker/*.sh docker/*.sql && chmod +x docker/*.sh

ENV NODE_ENV=development \
    SEED=20260101 \
    PROFILE=full \
    SCENARIO=decline-growth \
    START_YEAR=2005 \
    END_YEAR=2026 \
    OUT_DIR=/out

ENTRYPOINT ["/app/docker/pipeline.sh"]

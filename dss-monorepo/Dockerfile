# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.14 AS deps
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM deps AS builder
ARG APP_NAME
ARG NEXT_PUBLIC_BFF_URL
ARG NEXT_PUBLIC_ADMIN_PORTAL_URL
ARG NEXT_PUBLIC_RECTOR_DASHBOARD_URL
ARG NEXT_PUBLIC_DECANO_DASHBOARD_URL
ARG NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL
ENV NEXT_PUBLIC_BFF_URL=${NEXT_PUBLIC_BFF_URL} \
    NEXT_PUBLIC_ADMIN_PORTAL_URL=${NEXT_PUBLIC_ADMIN_PORTAL_URL} \
    NEXT_PUBLIC_RECTOR_DASHBOARD_URL=${NEXT_PUBLIC_RECTOR_DASHBOARD_URL} \
    NEXT_PUBLIC_DECANO_DASHBOARD_URL=${NEXT_PUBLIC_DECANO_DASHBOARD_URL} \
    NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL=${NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL}
RUN test -n "${APP_NAME}" \
    && bun nx build "@dss-monorepo/${APP_NAME}" \
    && test -f "apps/${APP_NAME}/.next/standalone/apps/${APP_NAME}/server.js" \
    && mkdir -p "/runtime/apps/${APP_NAME}/.next" \
    && cp -a "apps/${APP_NAME}/.next/standalone/." /runtime/ \
    && cp -a "apps/${APP_NAME}/.next/static" "/runtime/apps/${APP_NAME}/.next/static" \
    && if [ -d "apps/${APP_NAME}/public" ]; then \
         cp -a "apps/${APP_NAME}/public" "/runtime/apps/${APP_NAME}/public"; \
       fi

FROM node:22-alpine AS runner
ARG APP_NAME
ENV APP_NAME=${APP_NAME} \
    NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN apk add --no-cache libc6-compat \
    && addgroup -S -g 1001 app \
    && adduser -S -u 1001 -G app app
COPY --from=builder --chown=app:app /runtime/ /app/
USER app
EXPOSE 3000
CMD ["sh", "-c", "cd \"/app/apps/${APP_NAME}\" && exec node server.js"]

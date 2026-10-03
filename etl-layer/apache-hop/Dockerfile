ARG HOP_VERSION=latest

FROM golang:1.26.5 AS raw-verifier-builder
WORKDIR /src/etl-layer/loadmanager
COPY etl-layer/loadmanager/go.mod etl-layer/loadmanager/go.sum ./
RUN go mod download
COPY etl-layer/loadmanager/cmd ./cmd
COPY etl-layer/loadmanager/internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/raw-verify ./cmd/raw-verify

FROM apache/hop:${HOP_VERSION} AS hop-runner
COPY --chmod=0555 --from=raw-verifier-builder /out/raw-verify /usr/local/bin/raw-verify
COPY --chmod=0555 etl-layer/apache-hop/scripts/verify-raw-bundle.sh /usr/local/bin/verify-raw-bundle.sh

FROM apache/hop-web:${HOP_VERSION} AS hop-web
COPY --chmod=0555 --from=raw-verifier-builder /out/raw-verify /usr/local/bin/raw-verify
COPY --chmod=0555 etl-layer/apache-hop/scripts/verify-raw-bundle.sh /usr/local/bin/verify-raw-bundle.sh

FROM golang:1.26.5 AS builder
WORKDIR /src/etl-layer/loadmanager
COPY etl-layer/loadmanager/go.mod etl-layer/loadmanager/go.sum ./
RUN go mod download
COPY etl-layer/loadmanager/cmd ./cmd
COPY etl-layer/loadmanager/internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/loadmanager ./cmd/loadmanager
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/raw-extract ./cmd/raw-extract
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/raw-verify ./cmd/raw-verify

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/loadmanager /app/loadmanager
COPY etl-layer/loadmanager/configs/loadmanager.example.yaml /app/configs/loadmanager.yaml
COPY infra/postgres-tx/extract/ /app/queries/
ENV LOADMANAGER_CONFIG=/app/configs/loadmanager.yaml
ENV LOADMANAGER_QUERY_DIR=/app/queries
USER nonroot:nonroot
EXPOSE 8088
ENTRYPOINT ["/app/loadmanager"]

FROM gcr.io/distroless/static-debian12:nonroot AS raw-tools
WORKDIR /app
COPY --from=builder /out/raw-extract /app/raw-extract
COPY --from=builder /out/raw-verify /app/raw-verify
COPY etl-layer/loadmanager/configs/loadmanager.example.yaml /app/configs/loadmanager.yaml
COPY infra/postgres-tx/extract/ /app/queries/
ENV LOADMANAGER_QUERY_DIR=/app/queries
USER nonroot:nonroot
ENTRYPOINT ["/app/raw-verify"]
